import { NextRequest, NextResponse } from 'next/server';
import { logApiError } from '@/lib/api-errors';
import { getConversationForUser, markConversationAsRead } from '@/lib/chat-service';
import { requireRequestUser } from '@/lib/server-supabase';
import { createServiceRoleClient } from '@/lib/server-supabase-admin';

function invalidIdResponse() {
  return NextResponse.json(
    { error: 'Conversation ID is required.' },
    { status: 400 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return invalidIdResponse();
    }

    const admin = createServiceRoleClient();
    const conversation = await getConversationForUser(admin, id, user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    await markConversationAsRead(admin, id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('chat:mark-read', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read.' },
      { status: 500 }
    );
  }
}
