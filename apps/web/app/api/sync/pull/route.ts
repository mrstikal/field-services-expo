import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from '@db/env';

type BusinessRole = 'technician' | 'dispatcher';

function throwIfSupabaseError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

/**
 * Sync Pull API - Returns changes since last sync timestamp
 * Used by mobile app to fetch server-side changes
 * 
 * POST /api/sync/pull
 * Body: { lastSyncTimestamp: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabaseUrl = getSupabaseServerUrl();
    const supabaseServiceRoleKey = getSupabaseServiceRoleKey();

    // Verify token and get user
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's business role from users table
    const { data: userRecords, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .limit(1);

    throwIfSupabaseError(userError, 'Failed to load sync user');

    if (!userRecords || userRecords.length === 0) {
      return NextResponse.json({ error: 'User not found in users table' }, { status: 401 });
    }

    const businessRole = userRecords[0].role as BusinessRole;

    // Parse request body
    const body = await request.json();
    const { lastSyncTimestamp } = body;

    if (!lastSyncTimestamp) {
      return NextResponse.json(
        { error: 'lastSyncTimestamp is required' },
        { status: 400 }
      );
    }

    // Get tasks changed since last sync
    let tasksQuery = supabase
      .from('tasks')
      .select('*')
      .gte('updated_at', lastSyncTimestamp)
      .order('updated_at', { ascending: false });

    if (businessRole === 'technician') {
      tasksQuery = tasksQuery.eq('technician_id', user.id);
    }

    const { data: changedTasks = [], error: tasksError } = await tasksQuery;
    throwIfSupabaseError(tasksError, 'Failed to load changed tasks');

    // Get reports changed since last sync
    const { data: reportsSinceLastSync, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .gte('updated_at', lastSyncTimestamp)
      .order('updated_at', { ascending: false });

    throwIfSupabaseError(reportsError, 'Failed to load changed reports');

    let changedReports = (reportsSinceLastSync ?? []) as Array<Record<string, unknown>>;

    // Filter reports based on user role
    if (businessRole === 'technician') {
      const taskIds = [
        ...new Set(
          changedReports
            .map((report) => report.task_id)
            .filter((taskId): taskId is string => typeof taskId === 'string' && taskId.length > 0)
        ),
      ];

      if (taskIds.length > 0) {
        const { data: reportTasks, error: reportTasksError } = await supabase
          .from('tasks')
          .select('id, technician_id')
          .in('id', taskIds);

        throwIfSupabaseError(reportTasksError, 'Failed to map reports to technicians');

        const technicianIdsByTaskId = new Map(
          ((reportTasks ?? []) as Array<{ id: string; technician_id: string | null }>).map((task) => [task.id, task.technician_id])
        );
        changedReports = changedReports.filter((report) => technicianIdsByTaskId.get(report.task_id as string) === user.id);
      } else {
        changedReports = [];
      }
    }

    // Get locations changed since last sync
    let locationsQuery = supabase
      .from('locations')
      .select('*')
      .gte('timestamp', lastSyncTimestamp)
      .order('timestamp', { ascending: false });

    if (businessRole === 'technician') {
      locationsQuery = locationsQuery.eq('technician_id', user.id);
    }

    const { data: changedLocations = [], error: locationsError } = await locationsQuery;
    throwIfSupabaseError(locationsError, 'Failed to load changed locations');

    return NextResponse.json({
      success: true,
      data: {
        tasks: changedTasks,
        reports: changedReports,
        locations: changedLocations,
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}