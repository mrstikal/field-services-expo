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

    if (statusParam && !parsedStatus?.success) {
      return NextResponse.json(
        { error: 'Invalid task status filter.' },
        { status: 400 }
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const buildQuery = (withDeletedAtFilter: boolean) => {
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (withDeletedAtFilter) {
        query = query.is('deleted_at', null);
      }

      if (parsedStatus?.success) {
        query = query.eq('status', parsedStatus.data);
      }

      return query;
    };

    let { data, count, error: tasksError } = await buildQuery(true);
    if (isMissingDeletedAtColumnError(tasksError)) {
      ({ data, count, error: tasksError } = await buildQuery(false));
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
