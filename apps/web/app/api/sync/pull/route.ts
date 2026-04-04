import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tasks, reports, locations, users } from '@db/schema';
import { gte, desc, eq, inArray } from 'drizzle-orm';
import { db, connect } from '@db';

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
    const { lastSyncTimestamp } = body;

    if (!lastSyncTimestamp) {
      return NextResponse.json(
        { error: 'lastSyncTimestamp is required' },
        { status: 400 }
      );
    }

    // Get tasks changed since last sync
    let changedTasks = await db
      .select()
      .from(tasks)
      .where(gte(tasks.updated_at, lastSyncTimestamp))
      .orderBy(desc(tasks.updated_at));

    // Filter tasks based on user role
    if (businessRole === 'technician') {
      changedTasks = changedTasks.filter((t) => t.technician_id === user.id);
    }

    // Get reports changed since last sync
    let changedReports = await db
      .select()
      .from(reports)
      .where(gte(reports.updated_at, lastSyncTimestamp))
      .orderBy(desc(reports.updated_at));

    // Filter reports based on user role
    if (businessRole === 'technician') {
      // For technicians, only fetch reports for tasks assigned to them
      const changedReportIds = changedReports.map(r => r.id);
      if (changedReportIds.length > 0) {
        const reportToTaskMap = await db
          .select({ 
            report_id: reports.id,
            task_technician_id: tasks.technician_id
          })
          .from(reports)
          .leftJoin(tasks, eq(reports.task_id, tasks.id))
          .where(inArray(reports.id, changedReportIds));
          
        const reportToTechMap = new Map(reportToTaskMap.map(item => [item.report_id, item.task_technician_id]));
        
        changedReports = changedReports.filter((r) => {
          return reportToTechMap.get(r.id) === user.id;
        });
      }
    }

    // Get locations changed since last sync
    let changedLocations = await db
      .select()
      .from(locations)
      .where(gte(locations.timestamp, lastSyncTimestamp))
      .orderBy(desc(locations.timestamp));

    // For dispatcher, return all locations; for technician, only own locations
    if (businessRole === 'technician') {
      changedLocations = changedLocations.filter(
        (loc) => loc.technician_id === user.id
      );
    }

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