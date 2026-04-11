import { NextRequest, NextResponse } from 'next/server';
import {
  businessRoleSchema,
  syncPullRequestSchema,
} from '@field-service/shared-types';
import { logApiError } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { requireBearerUser } from '@/lib/server-supabase';
import { createServiceRoleClient } from '@/lib/server-supabase-admin';

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

async function loadChatSyncData(userId: string, lastSyncTimestamp: string) {
  const admin = createServiceRoleClient();

  const { data: accessibleConversations, error: conversationsAccessError } =
    await admin
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  if (conversationsAccessError) {
    throw conversationsAccessError;
  }

  const allConversations = accessibleConversations ?? [];
  const conversationIds = allConversations
    .map(conversation => conversation.id)
    .filter((id): id is string => typeof id === 'string');

  const conversations = allConversations.filter(conversation => {
    const updatedAt = Date.parse(conversation.updated_at);
    return Number.isFinite(updatedAt)
      ? updatedAt >= Date.parse(lastSyncTimestamp)
      : false;
  });

  if (conversationIds.length === 0) {
    return {
      conversations,
      messages: [],
      messageReads: [],
      chatUsers: [],
    };
  }

  const messagesResult = await admin
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .or(
      `sent_at.gte.${lastSyncTimestamp},edited_at.gte.${lastSyncTimestamp},deleted_at.gte.${lastSyncTimestamp}`
    )
    .order('sent_at', { ascending: true });

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  const messages = messagesResult.data ?? [];
  const accessibleMessageIdsResult = await admin
    .from('messages')
    .select('id')
    .in('conversation_id', conversationIds);

  if (accessibleMessageIdsResult.error) {
    throw accessibleMessageIdsResult.error;
  }

  const messageIds = (accessibleMessageIdsResult.data ?? [])
    .map(message => message.id)
    .filter((id): id is string => typeof id === 'string');

  const messageReadsResult =
    messageIds.length > 0
      ? await admin
          .from('message_reads')
          .select('*')
          .in('message_id', messageIds)
          .gte('read_at', lastSyncTimestamp)
          .order('read_at', { ascending: true })
      : { data: [], error: null };

  if (messageReadsResult.error) {
    throw messageReadsResult.error;
  }

  const relatedUserIds = new Set<string>();
  relatedUserIds.add(userId);

  for (const conversation of allConversations) {
    if (typeof conversation.user1_id === 'string') {
      relatedUserIds.add(conversation.user1_id);
    }
    if (typeof conversation.user2_id === 'string') {
      relatedUserIds.add(conversation.user2_id);
    }
  }

  for (const message of messages) {
    if (typeof message.sender_id === 'string') {
      relatedUserIds.add(message.sender_id);
    }
  }

  const chatUsersResult =
    relatedUserIds.size > 0
      ? await admin
          .from('users')
          .select('id, email, role, name, phone, avatar_url')
          .in('id', [...relatedUserIds])
      : { data: [], error: null };

  if (chatUsersResult.error) {
    throw chatUsersResult.error;
  }

  return {
    conversations,
    messages,
    messageReads: messageReadsResult.data ?? [],
    chatUsers: chatUsersResult.data ?? [],
  };
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

    const rateLimit = checkRateLimit(`sync-pull:${user.id}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many sync pull requests.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const parsedBody = syncPullRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid sync pull payload.',
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const lastSyncTimestamp = parsedBody.data.lastSyncTimestamp;
    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (userProfileError) {
      throw userProfileError;
    }

    const parsedRole = businessRoleSchema.safeParse(
      (userProfile as { role?: string } | null)?.role
    );
    const userRole = parsedRole.success ? parsedRole.data : 'technician';
    const chatData = await loadChatSyncData(user.id, lastSyncTimestamp);

    if (userRole === 'technician') {
      const [tasksResult, locationsResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('technician_id', user.id)
          .gte('updated_at', lastSyncTimestamp)
          .order('updated_at', { ascending: true }),
        supabase
          .from('locations')
          .select('*')
          .eq('technician_id', user.id)
          .gte('timestamp', lastSyncTimestamp)
          .order('timestamp', { ascending: true }),
      ]);

      if (tasksResult.error || locationsResult.error) {
        throw tasksResult.error || locationsResult.error;
      }

      const taskIds = (tasksResult.data ?? [])
        .map(task => task.id)
        .filter((id): id is string => typeof id === 'string');

      const reportsResult =
        taskIds.length > 0
          ? await supabase
              .from('reports')
              .select('*')
              .in('task_id', taskIds)
              .gte('updated_at', lastSyncTimestamp)
              .order('updated_at', { ascending: true })
          : { data: [], error: null };

      if (reportsResult.error) {
        throw reportsResult.error;
      }

      return NextResponse.json({
        success: true,
        data: {
          tasks: tasksResult.data ?? [],
          reports: reportsResult.data ?? [],
          locations: locationsResult.data ?? [],
          conversations: chatData.conversations,
          messages: chatData.messages,
          messageReads: chatData.messageReads,
          chatUsers: chatData.chatUsers,
          serverTimestamp: new Date().toISOString(),
        },
      });
    }

    const [tasksResult, reportsResult, locationsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .gte('updated_at', lastSyncTimestamp)
        .order('updated_at', { ascending: true }),
      supabase
        .from('reports')
        .select('*')
        .gte('updated_at', lastSyncTimestamp)
        .order('updated_at', { ascending: true }),
      supabase
        .from('locations')
        .select('*')
        .gte('timestamp', lastSyncTimestamp)
        .order('timestamp', { ascending: true }),
    ]);

    if (tasksResult.error || reportsResult.error || locationsResult.error) {
      throw tasksResult.error || reportsResult.error || locationsResult.error;
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasksResult.data ?? [],
        reports: reportsResult.data ?? [],
        locations: locationsResult.data ?? [],
        conversations: chatData.conversations,
        messages: chatData.messages,
        messageReads: chatData.messageReads,
        chatUsers: chatData.chatUsers,
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logApiError('sync:pull', error);
    return NextResponse.json(
      { error: 'Unable to pull sync changes.' },
      { status: 500 }
    );
  }
}
