import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logApiError } from '@/lib/api-errors';
import { buildConversationDetails } from '@/lib/chat-service';
import { requireBearerUser, requireRequestUser } from '@/lib/server-supabase';
import { createServiceRoleClient } from '@/lib/server-supabase-admin';

const requestSchema = z.object({
  otherUserId: z.string().uuid(),
});

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createServiceRoleClient();

    const { data: conversations, error: conversationsError } = await admin
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (conversationsError) {
      throw conversationsError;
    }

    const conversationDetails = await Promise.all(
      (conversations || []).map(conversation =>
        buildConversationDetails(admin, conversation, user.id)
      )
    );

    return NextResponse.json({ conversations: conversationDetails });
  } catch (error) {
    logApiError('chat:list-conversations', error);
    return NextResponse.json(
      { error: 'Failed to load conversations.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = await requireBearerUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedBody = requestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body.',
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { otherUserId } = parsedBody.data;
    if (otherUserId === user.id) {
      return NextResponse.json(
        { error: 'Cannot create a conversation with yourself.' },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();

    const { data: otherUser, error: otherUserError } = await admin
      .from('users')
      .select('id')
      .eq('id', otherUserId)
      .maybeSingle();

    if (otherUserError) {
      throw otherUserError;
    }
    if (!otherUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const { data: existingPreferred, error: existingPreferredError } = await admin
      .from('conversations')
      .select('id')
      .eq('user1_id', user.id)
      .eq('user2_id', otherUserId)
      .maybeSingle();

    if (existingPreferredError) {
      throw existingPreferredError;
    }

    if (existingPreferred) {
      return NextResponse.json({ conversationId: existingPreferred.id });
    }

    const { data: existingReversed, error: existingReversedError } = await admin
      .from('conversations')
      .select('id')
      .eq('user1_id', otherUserId)
      .eq('user2_id', user.id)
      .maybeSingle();

    if (existingReversedError) {
      throw existingReversedError;
    }

    if (existingReversed) {
      const { data: readableByCaller, error: readableCheckError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', existingReversed.id)
        .maybeSingle();

      if (readableCheckError) {
        throw readableCheckError;
      }

      if (readableByCaller) {
        return NextResponse.json({ conversationId: existingReversed.id });
      }
    }

    const { data: created, error: insertError } = await admin
      .from('conversations')
      .insert({
        user1_id: user.id,
        user2_id: otherUserId,
      })
      .select('id')
      .single();

    if (insertError) {
      const code =
        typeof insertError === 'object' &&
        insertError &&
        'code' in insertError
          ? String(insertError.code)
          : '';

      if (code === '23505') {
        const { data: afterConflict } = await admin
          .from('conversations')
          .select('id')
          .eq('user1_id', user.id)
          .eq('user2_id', otherUserId)
          .maybeSingle();

        if (afterConflict) {
          return NextResponse.json({ conversationId: afterConflict.id });
        }
      }

      throw insertError;
    }

    return NextResponse.json({ conversationId: created.id });
  } catch (error) {
    logApiError('chat:create-conversation', error);
    return NextResponse.json(
      { error: 'Failed to create conversation.' },
      { status: 500 }
    );
  }
}
