
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
 * Sync Push API - Processes local changes from mobile app
 * Used by mobile app to send offline changes to server
 * 
 * POST /api/sync/push
 * Body: { changes: Array<{ type: 'task'|'report'|'location', action: 'create'|'update'|'delete', data: any, version: number }> }
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
    const supabase: any = createClient(
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
    const { changes } = body;

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: 'changes array is required' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      conflicts: [] as string[],
      itemResults: [] as Array<{
        id: string;
        status: 'success' | 'failed' | 'conflict';
        error?: string;
      }>,
    };

    // Process each change
    for (const change of changes) {
      const queueItemId = typeof change.id === 'string' ? change.id : '';
      try {
        const { type, action, data, version } = change;

        // Check authorization before processing any change
         const authorized = await checkAuthorization(supabase, user.id, businessRole, type, action, data);
        if (!authorized) {
          throw new Error(`Unauthorized to ${action} ${type} - insufficient permissions`);
        }

        // Check for conflicts (version mismatch)
         const localVersion = await getLocalVersion(supabase, type, data.id);
        if (localVersion && localVersion > version) {
          // Local version is newer - conflict!
          results.conflicts.push(`${type}:${data.id}`);
          if (queueItemId) {
            results.itemResults.push({
              id: queueItemId,
              status: 'conflict',
              error: `${type}:${data.id} - version conflict`,
            });
          }
          continue;
        }

        // Process based on type and action
        switch (type) {
          case 'task':
            await processTaskChange(supabase, action, data);
            break;
          case 'report':
            await processReportChange(supabase, action, data);
            break;
          case 'location':
            await processLocationChange(supabase, action, data);
            break;
          default:
            throw new Error(`Unknown type: ${type}`);
        }

        results.success++;
        if (queueItemId) {
          results.itemResults.push({ id: queueItemId, status: 'success' });
        }
      } catch (error) {
        console.error(`Error processing change:`, error);
        results.failed++;
        const message = `${change.type}:${change.data.id} - ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(message);
        if (queueItemId) {
          results.itemResults.push({
            id: queueItemId,
            status: 'failed',
            error: message,
          });
        }
      }
    }

    // Update sync_queue status on server (only for successfully processed changes)
    // We'll now update individual items based on actual results
    const syncQueueUpdates = results.itemResults
      .filter((item) => item.status === 'success')
      .map((item) => item.id);

    if (syncQueueUpdates.length > 0) {
      const { error: syncQueueUpdateError } = await supabase
        .from('sync_queue')
        .update({ status: 'synced' })
        .in('id', syncQueueUpdates);

      throwIfSupabaseError(syncQueueUpdateError, 'Failed to mark sync queue items as synced');
    }

    return NextResponse.json({
      success: true,
      results,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Authorization helper function
async function checkAuthorization(
  supabase: any,
  userId: string,
  userRole: string,
  type: string,
  action: string,
  data: Record<string, unknown>
): Promise<boolean> {
  switch (type) {
    case 'task':
      // Dispatcher can do anything with tasks
      if (userRole === 'dispatcher') {
        return true;
      }
      
      // Technician can only create/update/delete tasks assigned to them
      if (userRole === 'technician') {
        if (action === 'create') {
          // Technician can only create tasks assigned to themselves
          return data.technician_id === userId;
        } else {
          const { data: taskRowsRaw, error: taskError } = await supabase
            .from('tasks')
            .select('technician_id')
            .eq('id', data.id as string)
            .limit(1);

          throwIfSupabaseError(taskError, 'Failed to validate task ownership');

          const taskRows = (taskRowsRaw ?? []) as Array<{ technician_id: string | null }>;

          if (!taskRows || taskRows.length === 0) {
            // If task doesn't exist and it's an update/delete, authorize based on whether it should exist
            // In practice, we should check the sync queue or have the client send more context
            // For now, we'll allow it and let the DB operation fail if the record doesn't exist
            return true;
          }
          return taskRows[0].technician_id === userId;
        }
      }
      break;

    case 'report':
      // Dispatcher can do anything with reports
      if (userRole === 'dispatcher') {
        return true;
      }
      
      // Technician can only operate on reports for tasks assigned to them
      if (userRole === 'technician') {
        const reportId = data.id as string | undefined;
        const reportTaskId = data.task_id as string | undefined;

        if (action === 'create') {
          if (!reportTaskId) {
            return false;
          }

          const { data: taskRowsRaw, error: taskError } = await supabase
            .from('tasks')
            .select('technician_id')
            .eq('id', reportTaskId)
            .limit(1);

          throwIfSupabaseError(taskError, 'Failed to validate report task ownership');

          const taskRows = (taskRowsRaw ?? []) as Array<{ technician_id: string | null }>;

          return Boolean(taskRows?.length && taskRows[0].technician_id === userId);
        }

        if (!reportId) {
          return false;
        }

        const { data: reportRowsRaw, error: reportError } = await supabase
          .from('reports')
          .select('task_id')
          .eq('id', reportId)
          .limit(1);

        throwIfSupabaseError(reportError, 'Failed to load report ownership');

        const reportRows = (reportRowsRaw ?? []) as Array<{ task_id: string | null }>;
        const resolvedTaskId = reportRows?.[0]?.task_id;
        if (!resolvedTaskId) {
          return false;
        }

        const { data: taskRowsRaw, error: reportTaskError } = await supabase
          .from('tasks')
          .select('technician_id')
          .eq('id', resolvedTaskId)
          .limit(1);

        throwIfSupabaseError(reportTaskError, 'Failed to load task for report ownership');

        const taskRows = (taskRowsRaw ?? []) as Array<{ technician_id: string | null }>;

        return Boolean(taskRows?.length && taskRows[0].technician_id === userId);
      }
      break;

    case 'location':
      // Technician can only create/update their own location
      if (userRole === 'technician' || userRole === 'dispatcher') {
        return data.technician_id === userId;
      }
      break;
  }

  return false;
}

// Helper: Get local version of a record
async function getLocalVersion(supabase: any, type: string, id: string): Promise<number | null> {
  try {
    switch (type) {
      case 'task': {
        const { data: taskVersionsRaw, error } = await supabase
          .from('tasks')
          .select('version')
          .eq('id', id)
          .limit(1);

        throwIfSupabaseError(error, 'Failed to load task version');
        const taskVersions = (taskVersionsRaw ?? []) as Array<{ version: number | null }>;
        return taskVersions.length ? taskVersions[0].version : null;
      }
      case 'report': {
        const { data: reportVersionsRaw, error } = await supabase
          .from('reports')
          .select('version')
          .eq('id', id)
          .limit(1);

        throwIfSupabaseError(error, 'Failed to load report version');
        const reportVersions = (reportVersionsRaw ?? []) as Array<{ version: number | null }>;
        return reportVersions.length ? reportVersions[0].version : null;
      }
      case 'location': {
        // Locations table doesn't have version column
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Helper: Process task changes
async function processTaskChange(supabase: any, action: string, data: Record<string, unknown>) {
  switch (action) {
    case 'create': {
      const { error } = await supabase.from('tasks').upsert([data], { onConflict: 'id' });
      throwIfSupabaseError(error, 'Failed to upsert task');
      break;
    }
    case 'update': {
      const { error } = await supabase.from('tasks').update(data).eq('id', data.id as string);
      throwIfSupabaseError(error, 'Failed to update task');
      break;
    }
    case 'delete': {
      const { error } = await supabase.from('tasks').delete().eq('id', data.id as string);
      throwIfSupabaseError(error, 'Failed to delete task');
      break;
    }
  }
}

// Helper: Process report changes
async function processReportChange(supabase: any, action: string, data: Record<string, unknown>) {
  switch (action) {
    case 'create': {
      const { error } = await supabase.from('reports').upsert([data], { onConflict: 'id' });
      throwIfSupabaseError(error, 'Failed to upsert report');
      break;
    }
    case 'update': {
      const { error } = await supabase.from('reports').update(data).eq('id', data.id as string);
      throwIfSupabaseError(error, 'Failed to update report');
      break;
    }
    case 'delete': {
      const { error } = await supabase.from('reports').delete().eq('id', data.id as string);
      throwIfSupabaseError(error, 'Failed to delete report');
      break;
    }
  }
}

// Helper: Process location changes
async function processLocationChange(supabase: any, action: string, data: Record<string, unknown>) {
  switch (action) {
    case 'create': {
      const { error } = await supabase.from('locations').upsert([data], { onConflict: 'id' });
      throwIfSupabaseError(error, 'Failed to upsert location');
      break;
    }
    case 'update': {
      const { error } = await supabase.from('locations').update(data).eq('id', data.id as string);
      throwIfSupabaseError(error, 'Failed to update location');
      break;
    }
    case 'delete': {
      const { error } = await supabase.from('locations').delete().eq('id', data.id as string);
      throwIfSupabaseError(error, 'Failed to delete location');
      break;
    }
  }
}
