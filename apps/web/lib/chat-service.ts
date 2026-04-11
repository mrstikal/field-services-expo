import type {
  BusinessRole,
  Conversation,
  ConversationWithDetails,
  Message,
  MessageWithSender,
} from '@field-service/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

const UNKNOWN_ROLE: BusinessRole = 'technician';

type AdminClient = SupabaseClient;
type UserSummary = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: BusinessRole;
};

function fallbackOtherUser(userId: string): UserSummary {
  return {
    id: userId,
    name: 'Unknown User',
    email: '',
    avatar_url: null,
    role: UNKNOWN_ROLE,
  };
}

export async function getConversationForUser(
  admin: AdminClient,
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const { data, error } = await admin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (data.user1_id !== userId && data.user2_id !== userId) {
    return null;
  }

  return data satisfies Conversation;
}

async function getOtherUser(
  admin: AdminClient,
  otherUserId: string
): Promise<UserSummary> {
  const { data, error } = await admin
    .from('users')
    .select('id, name, email, avatar_url, role')
    .eq('id', otherUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || fallbackOtherUser(otherUserId);
}

async function getLastMessage(
  admin: AdminClient,
  conversationId: string
): Promise<Message | undefined> {
  const { data, error } = await admin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || undefined;
}

async function getUnreadCount(
  admin: AdminClient,
  conversationId: string,
  userId: string
): Promise<number> {
  const { data: foreignMessages, error: foreignMessagesError } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  if (foreignMessagesError) {
    throw foreignMessagesError;
  }

  const unreadMessageIds = (foreignMessages || []).map(message => message.id);
  if (unreadMessageIds.length === 0) {
    return 0;
  }

  const { data: readRows, error: readRowsError } = await admin
    .from('message_reads')
    .select('message_id')
    .in('message_id', unreadMessageIds)
    .eq('user_id', userId);

  if (readRowsError) {
    throw readRowsError;
  }

  const readIds = new Set((readRows || []).map(row => row.message_id));
  return unreadMessageIds.filter(id => !readIds.has(id)).length;
}

export async function buildConversationDetails(
  admin: AdminClient,
  conversation: Conversation,
  userId: string
): Promise<ConversationWithDetails> {
  const otherUserId =
    conversation.user1_id === userId
      ? conversation.user2_id
      : conversation.user1_id;

  const [otherUser, lastMessage, unreadCount] = await Promise.all([
    getOtherUser(admin, otherUserId),
    getLastMessage(admin, conversation.id),
    getUnreadCount(admin, conversation.id, userId),
  ]);

  return {
    ...conversation,
    other_user: otherUser,
    last_message: lastMessage,
    unread_count: unreadCount,
  } satisfies ConversationWithDetails;
}

export async function loadConversationMessages(
  admin: AdminClient,
  conversationId: string,
  userId: string
): Promise<MessageWithSender[]> {
  const { data: rawMessages, error: messagesError } = await admin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: true });

  if (messagesError) {
    throw messagesError;
  }

  const messages = rawMessages || [];
  if (messages.length === 0) {
    return [];
  }

  const senderIds = [...new Set(messages.map(message => message.sender_id))];
  const { data: senders, error: sendersError } = await admin
    .from('users')
    .select('id, name, avatar_url')
    .in('id', senderIds);

  if (sendersError) {
    throw sendersError;
  }

  const senderMap = new Map(
    (senders || []).map(sender => [sender.id, sender])
  );

  const messageIds = messages.map(message => message.id);
  const { data: reads, error: readsError } = await admin
    .from('message_reads')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('user_id', userId);

  if (readsError) {
    throw readsError;
  }

  const readMessageIds = new Set((reads || []).map(read => read.message_id));

  return messages.map(message => {
    const sender = senderMap.get(message.sender_id);
    return {
      ...message,
      sender: sender || {
        id: message.sender_id,
        name: 'Unknown User',
        avatar_url: null,
      },
      is_read: readMessageIds.has(message.id),
    } satisfies MessageWithSender;
  });
}

export async function markConversationAsRead(
  admin: AdminClient,
  conversationId: string,
  userId: string
) {
  const { data: unreadMessages, error: unreadError } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  if (unreadError) {
    throw unreadError;
  }

  const unreadMessageIds = (unreadMessages || []).map(message => message.id);
  if (unreadMessageIds.length === 0) {
    return;
  }

  const { data: existingReads, error: existingReadsError } = await admin
    .from('message_reads')
    .select('message_id')
    .in('message_id', unreadMessageIds)
    .eq('user_id', userId);

  if (existingReadsError) {
    throw existingReadsError;
  }

  const existingReadIds = new Set(
    (existingReads || []).map(read => read.message_id)
  );
  const readAt = new Date().toISOString();
  const rowsToInsert = unreadMessageIds
    .filter(messageId => !existingReadIds.has(messageId))
    .map(messageId => ({
      id: crypto.randomUUID(),
      message_id: messageId,
      user_id: userId,
      read_at: readAt,
    }));

  if (rowsToInsert.length === 0) {
    return;
  }

  const { error: insertError } = await admin
    .from('message_reads')
    .upsert(rowsToInsert, { onConflict: 'message_id,user_id' });

  if (insertError) {
    throw insertError;
  }
}

export async function sendConversationMessage(
  admin: AdminClient,
  conversationId: string,
  senderId: string,
  content: string
) {
  const now = new Date().toISOString();

  const { data: message, error: insertError } = await admin
    .from('messages')
    .insert({
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      sent_at: now,
    })
    .select('*')
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: updateConversationError } = await admin
    .from('conversations')
    .update({ updated_at: now })
    .eq('id', conversationId);

  if (updateConversationError) {
    throw updateConversationError;
  }

  const { data: sender, error: senderError } = await admin
    .from('users')
    .select('id, name, avatar_url')
    .eq('id', senderId)
    .maybeSingle();

  if (senderError) {
    throw senderError;
  }

  return {
    ...message,
    sender: sender || {
      id: senderId,
      name: 'Unknown User',
      avatar_url: null,
    },
    is_read: true,
  } satisfies MessageWithSender;
}
