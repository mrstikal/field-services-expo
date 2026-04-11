import { NextRequest, NextResponse } from 'next/server';
import { logApiError } from '@/lib/api-errors';
import { buildConversationDetails, getConversationForUser } from '@/lib/chat-service';
import { requireRequestUser } from '@/lib/server-supabase';
import { createServiceRoleClient } from '@/lib/server-supabase-admin';

function invalidIdResponse() {
  return NextResponse.json(
    { error: 'Conversation ID is required.' },
    { status: 400 }
  );
}

export async function GET(
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

    const payload = await buildConversationDetails(admin, conversation, user.id);
    return NextResponse.json(payload);
  } catch (error) {
    logApiError('chat:get-conversation', error);
    return NextResponse.json(
      { error: 'Failed to load conversation.' },
      { status: 500 }
    );
  }
}
