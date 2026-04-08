import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from '@db/env';

function throwIfSupabaseError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

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
    const supabaseUrl = getSupabaseServerUrl();
    const supabaseServiceRoleKey = getSupabaseServiceRoleKey();

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user exists in users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .limit(1);

    throwIfSupabaseError(userError, 'Failed to load sync user');

    if (!userRecord || userRecord.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Count pending items in sync queue for this user
    const { data: pendingRows, error: pendingError } = await supabase
      .from('sync_queue')
      .select('id')
      .eq('user_id', user.id);

    throwIfSupabaseError(pendingError, 'Failed to load sync queue status');

    const pendingCount = pendingRows?.length ?? 0;

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
