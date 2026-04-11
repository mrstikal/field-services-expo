import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logApiError } from '@/lib/api-errors';
import { getAppUserProfile, isDispatcher } from '@/lib/server-auth';
import { requireRequestUser } from '@/lib/server-supabase';

const isoDateTimeSchema = z.string().datetime({ offset: true });
const requestSchema = z.object({
  tasksSince: isoDateTimeSchema.optional(),
  techniciansSince: isoDateTimeSchema.optional(),
  reportsSince: isoDateTimeSchema.optional(),
});

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

    const profile = await getAppUserProfile(supabase, user);
    if (!isDispatcher(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsedQuery = requestSchema.safeParse({
      tasksSince: request.nextUrl.searchParams.get('tasksSince') ?? undefined,
      techniciansSince:
        request.nextUrl.searchParams.get('techniciansSince') ?? undefined,
      reportsSince: request.nextUrl.searchParams.get('reportsSince') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Invalid badges query.',
          details: parsedQuery.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { tasksSince, techniciansSince, reportsSince } = parsedQuery.data;

    const countTasks = async () => {
      if (!tasksSince) {
        return 0;
      }

      const buildQuery = (withDeletedAtFilter: boolean) => {
        let query = supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .gt('updated_at', tasksSince);

        if (withDeletedAtFilter) {
          query = query.is('deleted_at', null);
        }

        return query;
      };

      let { count, error: tasksError } = await buildQuery(true);
      if (isMissingDeletedAtColumnError(tasksError)) {
        ({ count, error: tasksError } = await buildQuery(false));
      }

      if (tasksError) {
        throw tasksError;
      }

      return count ?? 0;
    };

    const countTechnicians = async () => {
      if (!techniciansSince) {
        return 0;
      }

      const { count, error: techniciansError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'technician')
        .gt('created_at', techniciansSince);

      if (techniciansError) {
        throw techniciansError;
      }

      return count ?? 0;
    };

    const countReports = async () => {
      if (!reportsSince) {
        return 0;
      }

      const buildQuery = (withDeletedAtFilter: boolean) => {
        let query = supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', reportsSince);

        if (withDeletedAtFilter) {
          query = query.is('deleted_at', null);
        }

        return query;
      };

      let { count, error: reportsError } = await buildQuery(true);
      if (isMissingDeletedAtColumnError(reportsError)) {
        ({ count, error: reportsError } = await buildQuery(false));
      }

      if (reportsError) {
        throw reportsError;
      }

      return count ?? 0;
    };

    const [tasks, technicians, reports] = await Promise.all([
      countTasks(),
      countTechnicians(),
      countReports(),
    ]);

    return NextResponse.json({
      tasks,
      technicians,
      reports,
    });
  } catch (error) {
    logApiError('dashboard:badges', error);
    return NextResponse.json(
      { error: 'Unable to load dashboard badges.' },
      { status: 500 }
    );
  }
}
