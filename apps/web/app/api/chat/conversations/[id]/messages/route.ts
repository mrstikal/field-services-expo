import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logApiError } from '@/lib/api-errors';
import {
  getConversationForUser,
  loadConversationMessages,
  sendConversationMessage,
} from '@/lib/chat-service';
import { requireRequestUser } from '@/lib/server-supabase';
import { createServiceRoleClient } from '@/lib/server-supabase-admin';

const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});

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

    const messages = await loadConversationMessages(admin, id, user.id);
    return NextResponse.json({ messages });
  } catch (error) {
    logApiError('chat:list-messages', error);
    return NextResponse.json(
      { error: 'Failed to load messages.' },
      { status: 500 }
    );
  }
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

    const parsedBody = createMessageSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body.',
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();
    const conversation = await getConversationForUser(admin, id, user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    const message = await sendConversationMessage(
      admin,
      id,
      user.id,
      parsedBody.data.content
    );

    return NextResponse.json({ message });
  } catch (error) {
    logApiError('chat:create-message', error);
    return NextResponse.json(
      { error: 'Failed to send message.' },
      { status: 500 }
    );
  }
}
