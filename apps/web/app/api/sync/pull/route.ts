import { NextRequest, NextResponse } from 'next/server';
import { syncPullRequestSchema } from '@field-service/shared-types';
import { logApiError } from '@/lib/api-errors';
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
