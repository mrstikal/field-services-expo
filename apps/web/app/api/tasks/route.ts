import { NextRequest, NextResponse } from 'next/server';
import {
  taskCreateInputSchema,
  taskStatusSchema,
  type TaskListResponse,
} from '@field-service/shared-types';
import { requireRequestUser } from '@/lib/server-supabase';
import { getAppUserProfile, isDispatcher } from '@/lib/server-auth';
import { logApiError } from '@/lib/api-errors';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanFilter(value: string | null) {
  if (value === null) {
    return { value: false, isValid: true };
  }
  if (value === 'true') {
    return { value: true, isValid: true };
  }
  if (value === 'false') {
    return { value: false, isValid: true };
  }
  return { value: false, isValid: false };
}

function isMissingDeletedAtColumnError(
  error: { code?: string; message?: string } | null
) {
  if (!error) {
    return false;
  }

  return (
    error.code === '42703' ||
    (error.code === 'PGRST204' && error.message?.includes('deleted_at')) ===
      true
  );
}

function isOverdueTask(task: { due_date?: string; status?: string }) {
  if (!task.due_date || task.status === 'completed') {
    return false;
  }
  const dueTimestamp = new Date(task.due_date).getTime();
  if (!Number.isFinite(dueTimestamp)) {
    return false;
  }
  return dueTimestamp < Date.now();
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireRequestUser(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const page = parsePositiveInt(
      request.nextUrl.searchParams.get('page'),
      DEFAULT_PAGE
    );
    const pageSize = Math.min(
      parsePositiveInt(
        request.nextUrl.searchParams.get('pageSize'),
        DEFAULT_PAGE_SIZE
      ),
      MAX_PAGE_SIZE
    );
    const statusParam = request.nextUrl.searchParams.get('status');
    const parsedStatus = statusParam
      ? taskStatusSchema.safeParse(statusParam)
      : null;
    const overdueParam = request.nextUrl.searchParams.get('overdue');
    const parsedOverdue = parseBooleanFilter(overdueParam);
    const archivedParam = request.nextUrl.searchParams.get('archived');
    const parsedArchived = parseBooleanFilter(archivedParam);

    if (statusParam && !parsedStatus?.success) {
      return NextResponse.json(
        { error: 'Invalid task status filter.' },
        { status: 400 }
      );
    }
    if (!parsedOverdue.isValid) {
      return NextResponse.json(
        { error: 'Invalid overdue filter. Use true or false.' },
        { status: 400 }
      );
    }
    if (!parsedArchived.isValid) {
      return NextResponse.json(
        { error: 'Invalid archived filter. Use true or false.' },
        { status: 400 }
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const buildQuery = (
      withDeletedAtFilter: boolean,
      showArchived: boolean
    ) => {
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (withDeletedAtFilter) {
        if (showArchived) {
          query = query.not('deleted_at', 'is', null);
        } else {
          query = query.is('deleted_at', null);
        }
      }

      if (parsedStatus?.success) {
        query = query.eq('status', parsedStatus.data);
      }

      return query;
    };

    const buildOverdueBaseQuery = (
      withDeletedAtFilter: boolean,
      showArchived: boolean
    ) => {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (withDeletedAtFilter) {
        if (showArchived) {
          query = query.not('deleted_at', 'is', null);
        } else {
          query = query.is('deleted_at', null);
        }
      }

      if (parsedStatus?.success) {
        query = query.eq('status', parsedStatus.data);
      } else {
        query = query.neq('status', 'completed');
      }

      return query;
    };

    let data: unknown[] | null = null;
    let count: number | null = null;
    let tasksError: { code?: string; message?: string } | null = null;

    if (parsedOverdue.value) {
      let overdueQueryResult = await buildOverdueBaseQuery(
        true,
        parsedArchived.value
      );
      if (isMissingDeletedAtColumnError(overdueQueryResult.error)) {
        overdueQueryResult = await buildOverdueBaseQuery(
          false,
          parsedArchived.value
        );
      }
      tasksError = overdueQueryResult.error;
      if (!tasksError) {
        const filteredTasks = (
          (overdueQueryResult.data ?? []) as TaskListResponse['data']
        ).filter(isOverdueTask);
        count = filteredTasks.length;
        data = filteredTasks.slice(from, to + 1);
      }
    } else {
      let pagedQueryResult = await buildQuery(true, parsedArchived.value);
      if (isMissingDeletedAtColumnError(pagedQueryResult.error)) {
        pagedQueryResult = await buildQuery(false, parsedArchived.value);
      }
      data = pagedQueryResult.data;
      count = pagedQueryResult.count;
      tasksError = pagedQueryResult.error;
    }

    if (tasksError) {
      throw tasksError;
    }

    const response: TaskListResponse = {
      data: (data ?? []) as TaskListResponse['data'],
      totalCount: count ?? 0,
      page,
      pageSize,
    };

    return NextResponse.json(response);
  } catch (error) {
    logApiError('tasks:list', error);
    return NextResponse.json(
      { error: 'Unable to load tasks.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireRequestUser(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getAppUserProfile(supabase, user);
    if (!isDispatcher(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsedBody = taskCreateInputSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid task payload.', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const insertPayload = {
      ...parsedBody.data,
      created_at: now,
      updated_at: now,
      version: 1,
      deleted_at: null,
    };

    const buildInsertQuery = (withDeletedAtField: boolean) =>
      supabase
        .from('tasks')
        .insert([
          withDeletedAtField
            ? insertPayload
            : {
                ...parsedBody.data,
                created_at: now,
                updated_at: now,
                version: 1,
              },
        ])
        .select('*')
        .single();

    let { data, error: insertError } = await buildInsertQuery(true);
    if (isMissingDeletedAtColumnError(insertError)) {
      ({ data, error: insertError } = await buildInsertQuery(false));
    }

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logApiError('tasks:create', error);
    return NextResponse.json(
      { error: 'Unable to create task.' },
      { status: 400 }
    );
  }
}
