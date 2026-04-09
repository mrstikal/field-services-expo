import { NextRequest, NextResponse } from 'next/server';
import {
  businessRoleSchema,
  syncPullRequestSchema,
} from '@field-service/shared-types';
import { logApiError } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { requireBearerUser } from '@/lib/server-supabase';

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = await requireBearerUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`sync-pull:${user.id}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many sync pull requests.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const parsedBody = syncPullRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid sync pull payload.',
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const lastSyncTimestamp = parsedBody.data.lastSyncTimestamp;
    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (userProfileError) {
      throw userProfileError;
    }

    const parsedRole = businessRoleSchema.safeParse(
      (userProfile as { role?: string } | null)?.role
    );
    const userRole = parsedRole.success ? parsedRole.data : 'technician';

    if (userRole === 'technician') {
      const [tasksResult, locationsResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('technician_id', user.id)
          .gte('updated_at', lastSyncTimestamp)
          .order('updated_at', { ascending: true }),
        supabase
          .from('locations')
          .select('*')
          .eq('technician_id', user.id)
          .gte('timestamp', lastSyncTimestamp)
          .order('timestamp', { ascending: true }),
      ]);

      if (tasksResult.error || locationsResult.error) {
        throw tasksResult.error || locationsResult.error;
      }

      const taskIds = (tasksResult.data ?? [])
        .map(task => task.id)
        .filter((id): id is string => typeof id === 'string');

      const reportsResult =
        taskIds.length > 0
          ? await supabase
              .from('reports')
              .select('*')
              .in('task_id', taskIds)
              .gte('updated_at', lastSyncTimestamp)
              .order('updated_at', { ascending: true })
          : { data: [], error: null };

      if (reportsResult.error) {
        throw reportsResult.error;
      }

      return NextResponse.json({
        success: true,
        data: {
          tasks: tasksResult.data ?? [],
          reports: reportsResult.data ?? [],
          locations: locationsResult.data ?? [],
          serverTimestamp: new Date().toISOString(),
        },
      });
    }

    const [tasksResult, reportsResult, locationsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .gte('updated_at', lastSyncTimestamp)
        .order('updated_at', { ascending: true }),
      supabase
        .from('reports')
        .select('*')
        .gte('updated_at', lastSyncTimestamp)
        .order('updated_at', { ascending: true }),
      supabase
        .from('locations')
        .select('*')
        .gte('timestamp', lastSyncTimestamp)
        .order('timestamp', { ascending: true }),
    ]);

    if (tasksResult.error || reportsResult.error || locationsResult.error) {
      throw tasksResult.error || reportsResult.error || locationsResult.error;
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasksResult.data ?? [],
        reports: reportsResult.data ?? [],
        locations: locationsResult.data ?? [],
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logApiError('sync:pull', error);
    return NextResponse.json(
      { error: 'Unable to pull sync changes.' },
      { status: 500 }
    );
  }
}
