
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncQueue, tasks, reports, locations, users } from '@db/schema';
import { eq, inArray } from 'drizzle-orm';
import { db, connect } from '@db';

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

    // Verify token and get user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connect();

    // Get user's business role from users table
    const userRecord = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!userRecord.length) {
      return NextResponse.json({ error: 'User not found in users table' }, { status: 401 });
    }
    const businessRole = userRecord[0].role;

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
        const authorized = await checkAuthorization(user.id, businessRole, type, action, data);
        if (!authorized) {
          throw new Error(`Unauthorized to ${action} ${type} - insufficient permissions`);
        }

        // Check for conflicts (version mismatch)
        const localVersion = await getLocalVersion(type, data.id);
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
            await processTaskChange(action, data);
            break;
          case 'report':
            await processReportChange(action, data);
            break;
          case 'location':
            await processLocationChange(action, data);
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
      await db
        .update(syncQueue)
        .set({ status: 'synced' })
        .where(inArray(syncQueue.id, syncQueueUpdates));
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
async function checkAuthorization(userId: string, userRole: string, type: string, action: string, data: Record<string, unknown>): Promise<boolean> {
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
           // For update/delete, check if the existing task belongs to the technician
           const task = await db.select().from(tasks).where(eq(tasks.id, data.id as string)).limit(1);
          if (!task.length) {
            // If task doesn't exist and it's an update/delete, authorize based on whether it should exist
            // In practice, we should check the sync queue or have the client send more context
            // For now, we'll allow it and let the DB operation fail if the record doesn't exist
            return true;
          }
          return task[0].technician_id === userId;
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
        // Get the task associated with this report
        const reportTask = await db
          .select({ technician_id: tasks.technician_id })
          .from(reports)
          .leftJoin(tasks, eq(reports.task_id, tasks.id))
          .where(eq(reports.id, data.id as string))
          .limit(1);

        if (reportTask.length === 0) {
          // If creating a new report, check the task it belongs to
          if (action === 'create') {
            const task = await db.select().from(tasks).where(eq(tasks.id, data.task_id as string)).limit(1);
            if (task.length === 0) {
              // Task doesn't exist, can't validate ownership
              return false;
            }
            return task[0].technician_id === userId;
          } else {
            // For update/delete of existing report, check if it was for their task
            // This won't work as intended since we're querying by report ID, so check by data.id
            // But for update/delete actions, data.id refers to the report ID
            const taskOfReport = await db
              .select({ technician_id: tasks.technician_id })
              .from(reports)
              .leftJoin(tasks, eq(reports.task_id, tasks.id))
              .where(eq(reports.id, data.id as string))
              .limit(1);
              
            if (taskOfReport.length === 0) {
              return false;
            }
            
            return taskOfReport[0].technician_id === userId;
          }
        }
        
        return reportTask[0].technician_id === userId;
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
async function getLocalVersion(type: string, id: string): Promise<number | null> {
  try {
    switch (type) {
      case 'task': {
        const task = await db.select({ version: tasks.version }).from(tasks).where(eq(tasks.id, id)).limit(1);
        return task.length ? task[0].version : null;
      }
      case 'report': {
        const report = await db.select({ version: reports.version }).from(reports).where(eq(reports.id, id)).limit(1);
        return report.length ? report[0].version : null;
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
async function processTaskChange(action: string, data: Record<string, unknown>) {
  switch (action) {
    case 'create':
      // Use upsert with ON CONFLICT to handle duplicate keys gracefully
       await db.insert(tasks).values(data as typeof tasks.$inferInsert).onConflictDoUpdate({
         target: tasks.id,
         set: {
           title: (data.title as string) || '',
           description: (data.description as string) || '',
           address: (data.address as string) || '',
           latitude: data.latitude as number | null,
           longitude: data.longitude as number | null,
           status: (data.status as 'assigned' | 'in_progress' | 'completed') || 'assigned',
           priority: (data.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
           category: (data.category as 'repair' | 'installation' | 'maintenance' | 'inspection') || 'repair',
           due_date: new Date(data.due_date as string),
           customer_name: (data.customer_name as string) || '',
           customer_phone: (data.customer_phone as string) || '',
           estimated_time: (data.estimated_time as number) || 0,
           technician_id: data.technician_id as string | undefined,
           updated_at: new Date(data.updated_at as string),
           version: (data.version as number) || 1
         }
       });
      break;
    case 'update':
      await db.update(tasks).set(data).where(eq(tasks.id, data.id as string));
      break;
    case 'delete':
      await db.delete(tasks).where(eq(tasks.id, data.id as string));
      break;
  }
}

// Helper: Process report changes
async function processReportChange(action: string, data: Record<string, unknown>) {
  switch (action) {
    case 'create':
      // Use upsert with ON CONFLICT to handle duplicate keys gracefully
      await db.insert(reports).values(data as typeof reports.$inferInsert).onConflictDoUpdate({
        target: reports.id,
        set: {
          task_id: (data.task_id as string) || '',
          status: (data.status as 'draft' | 'completed' | 'synced') || 'draft',
          photos: (data.photos as string[]) || [],
          form_data: (data.form_data as Record<string, unknown>) || {},
          signature: data.signature as string | undefined,
          updated_at: new Date(data.updated_at as string),
          version: (data.version as number) || 1
        }
      });
      break;
    case 'update':
      await db.update(reports).set(data).where(eq(reports.id, data.id as string));
      break;
    case 'delete':
      await db.delete(reports).where(eq(reports.id, data.id as string));
      break;
  }
}

// Helper: Process location changes
async function processLocationChange(action: string, data: Record<string, unknown>) {
  switch (action) {
    case 'create':
      await db.insert(locations).values(data as typeof locations.$inferInsert);
      break;
    case 'update':
      await db.update(locations).set(data as typeof locations.$inferInsert).where(eq(locations.id, data.id as string));
      break;
    case 'delete':
      await db.delete(locations).where(eq(locations.id, data.id as string));
      break;
  }
}
