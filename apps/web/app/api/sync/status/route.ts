import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncQueue, users } from '@db/schema';
import { eq, count } from 'drizzle-orm';
import { db, connect } from '@db';

/**
 * Sync Status API - Returns sync queue status for the authenticated user
 * GET /api/sync/status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connect();

    // Verify user exists in users table
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userRecord.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Count pending items in sync queue for this user
    const [pendingResult] = await db
      .select({ value: count() })
      .from(syncQueue)
      .where(eq(syncQueue.user_id, user.id));

    const pendingCount = pendingResult?.value ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        pendingItems: pendingCount,
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
