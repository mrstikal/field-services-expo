import { NextRequest, NextResponse } from 'next/server';
import { taskUpdateInputSchema } from '@field-service/shared-types';
import { logApiError } from '@/lib/api-errors';
import { sendExpoPushNotification } from '@/lib/expo-push';
import { getAppUserProfile, isDispatcher } from '@/lib/server-auth';
import { requireRequestUser } from '@/lib/server-supabase';

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

function isMissingExpoPushTokenColumnError(
  error: { code?: string; message?: string } | null
) {
  if (!error) {
    return false;
  }

  return (
    error.code === '42703' ||
    (error.code === 'PGRST204' && error.message?.includes('expo_push_token')) ===
      true
  );
}

async function loadTask(
  supabase: Awaited<ReturnType<typeof requireRequestUser>>['supabase'],
  id: string
) {
  const buildQuery = (withDeletedAtFilter: boolean) => {
    let query = supabase.from('tasks').select('*').eq('id', id);

    if (withDeletedAtFilter) {
      query = query.is('deleted_at', null);
    }

    return query.maybeSingle();
  };

  let { data, error } = await buildQuery(true);
  if (isMissingDeletedAtColumnError(error)) {
    ({ data, error } = await buildQuery(false));
  }

  if (error) {
    throw error;
  }

  return data;
}

async function requireDispatcherAccess(request: NextRequest) {
  const context = await requireRequestUser(request);
  if (context.error || !context.user) {
    return {
      ...context,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const profile = await getAppUserProfile(context.supabase, context.user);
  if (!isDispatcher(profile)) {
    return {
      ...context,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ...context, response: null };
}

async function loadTechnicianPushTarget(
  supabase: Awaited<ReturnType<typeof requireRequestUser>>['supabase'],
  technicianId: string
) {
  const { data, error } = await supabase
    .from('users')
    .select('expo_push_token, name')
    .eq('id', technicianId)
    .maybeSingle();

  if (isMissingExpoPushTokenColumnError(error)) {
    return null;
  }

  if (error) {
    throw error;
  }

  if (!data || typeof data.expo_push_token !== 'string') {
    return null;
  }

  return {
    token: data.expo_push_token,
    name: typeof data.name === 'string' ? data.name : null,
  };
}

async function notifyTechnicianAboutAssignment(
  supabase: Awaited<ReturnType<typeof requireRequestUser>>['supabase'],
  existingTask: { technician_id?: string | null; title?: string | null; id?: string },
  updatedTask: { technician_id?: string | null; title?: string | null; id?: string }
) {
  const previousTechnicianId =
    typeof existingTask.technician_id === 'string'
      ? existingTask.technician_id
      : null;
  const nextTechnicianId =
    typeof updatedTask.technician_id === 'string'
      ? updatedTask.technician_id
      : null;

  if (!nextTechnicianId || nextTechnicianId === previousTechnicianId) {
    return;
  }

  const target = await loadTechnicianPushTarget(supabase, nextTechnicianId);
  if (!target?.token) {
    return;
  }

  await sendExpoPushNotification({
    to: target.token,
    title: 'New task assigned',
    body:
      typeof updatedTask.title === 'string' && updatedTask.title.length > 0
        ? updatedTask.title
        : 'You have a new assigned task.',
    data: {
      taskId: typeof updatedTask.id === 'string' ? updatedTask.id : null,
      type: 'task-assigned',
    },
  });
}

function invalidIdResponse() {
  return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user, error } = await requireRequestUser(_request);
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return invalidIdResponse();
    }

    const task = await loadTask(supabase, id);
    if (!task || task.deleted_at) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    logApiError('tasks:get', error);
    return NextResponse.json(
      { error: 'Unable to load task.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, response } = await requireDispatcherAccess(request);
    if (response) {
      return response;
    }

    const { id } = await params;
    if (!id) {
      return invalidIdResponse();
    }

    const existingTask = await loadTask(supabase, id);
    if (!existingTask || existingTask.deleted_at) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const parsedBody = taskUpdateInputSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid task payload.', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const payload = {
      ...parsedBody.data,
      updated_at: new Date().toISOString(),
      version: Number(existingTask.version ?? 0) + 1,
    };

    const buildUpdateQuery = (withDeletedAtFilter: boolean) => {
      let query = supabase.from('tasks').update(payload).eq('id', id);

      if (withDeletedAtFilter) {
        query = query.is('deleted_at', null);
      }

      return query.select('*').single();
    };

    let { data, error } = await buildUpdateQuery(true);
    if (isMissingDeletedAtColumnError(error)) {
      ({ data, error } = await buildUpdateQuery(false));
    }

    if (error) {
      throw error;
    }

    try {
      await notifyTechnicianAboutAssignment(
        supabase,
        existingTask as { technician_id?: string | null; title?: string | null; id?: string },
        data as { technician_id?: string | null; title?: string | null; id?: string }
      );
    } catch (notificationError) {
      logApiError('tasks:assignment-notification', notificationError);
    }

    return NextResponse.json(data);
  } catch (error) {
    logApiError('tasks:update', error);
    return NextResponse.json(
      { error: 'Unable to update task.' },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, response } = await requireDispatcherAccess(_request);
    if (response) {
      return response;
    }

    const { id } = await params;
    if (!id) {
      return invalidIdResponse();
    }

    const existingTask = await loadTask(supabase, id);
    if (!existingTask || existingTask.deleted_at) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const deletePayload = {
      deleted_at: now,
      updated_at: now,
      version: Number(existingTask.version ?? 0) + 1,
    };

    const buildDeleteQuery = (
      withDeletedAtFilter: boolean,
      withDeletedAtPayload: boolean
    ) => {
      let query = supabase
        .from('tasks')
        .update(
          withDeletedAtPayload
            ? deletePayload
            : {
                updated_at: now,
                version: Number(existingTask.version ?? 0) + 1,
              }
        )
        .eq('id', id);

      if (withDeletedAtFilter) {
        query = query.is('deleted_at', null);
      }

      return query;
    };

    let { error } = await buildDeleteQuery(true, true);
    if (isMissingDeletedAtColumnError(error)) {
      ({ error } = await buildDeleteQuery(false, false));
    }

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('tasks:delete', error);
    return NextResponse.json(
      { error: 'Unable to delete task.' },
      { status: 400 }
    );
  }
}
