import { NextRequest, NextResponse } from 'next/server';
import { logApiError } from '@/lib/api-errors';
import { requireBearerUser } from '@/lib/server-supabase';

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = await requireBearerUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        pendingItems: 0,
        trackedOnServer: false,
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logApiError('sync:status', error);
    return NextResponse.json(
      { error: 'Unable to load sync status.' },
      { status: 500 }
    );
  }
}
