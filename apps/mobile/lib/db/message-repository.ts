import type { SQLiteDatabase } from 'expo-sqlite';
import type { Message, MessageWithSender } from '@field-service/shared-types';
import { enqueueSyncChange } from '@/lib/sync/sync-events';
import { generateId } from '@/lib/utils/generate-id';

export async function getMessagesByConversation(
  db: SQLiteDatabase,
  conversationId: string,
  userId: string,
  limit = 50,
  offset = 0
): Promise<MessageWithSender[]> {
  const rows = await db.getAllAsync<{
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    sent_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    sender_name: string;
    sender_avatar_url: string | null;
    is_read: number;
  }>(
    `
    SELECT 
      m.*,
      u.name as sender_name,
      u.avatar_url as sender_avatar_url,
      CASE 
        WHEN mr.id IS NOT NULL THEN 1 
        ELSE 0 
      END as is_read
    FROM messages m
    INNER JOIN users u ON u.id = m.sender_id
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
    WHERE m.conversation_id = ?
      AND m.deleted_at IS NULL
    ORDER BY m.sent_at DESC
    LIMIT ? OFFSET ?
  `,
    [userId, conversationId, limit, offset]
  );

  return rows.reverse().map(row => ({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    sent_at: row.sent_at,
    edited_at: row.edited_at,
    deleted_at: row.deleted_at,
    sender: {
      id: row.sender_id,
      name: row.sender_name || 'Unknown User',
      avatar_url: row.sender_avatar_url,
    },
    is_read: row.is_read === 1,
  }));
}

export async function createMessage(
  db: SQLiteDatabase,
  conversationId: string,
  senderId: string,
  content: string
): Promise<Message> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    id,
    conversationId,
    senderId,
    content,
    now
  );

  await enqueueSyncChange({
    type: 'message',
    action: 'create',
    entityId: id,
    data: {
      id,
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      sent_at: now,
      edited_at: null,
      deleted_at: null,
    },
    version: null,
  });

  return {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    sent_at: now,
  };
}

export async function markMessageAsRead(
  db: SQLiteDatabase,
  messageId: string,
  userId: string
): Promise<void> {
  // Check if already marked as read
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM message_reads WHERE message_id = ? AND user_id = ?',
    [messageId, userId]
  );

  if (existing) {
    return;
  }

  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR IGNORE INTO message_reads (id, message_id, user_id, read_at, synced)
     VALUES (?, ?, ?, ?, 0)`,
    id,
    messageId,
    userId,
    now
  );

  const inserted = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM message_reads WHERE message_id = ? AND user_id = ?',
    [messageId, userId]
  );

  if (!inserted || inserted.id !== id) {
    return;
  }

  await enqueueSyncChange({
    type: 'message_read',
    action: 'create',
    entityId: id,
    data: {
      id,
      message_id: messageId,
      user_id: userId,
      read_at: now,
    },
    version: null,
  });
}

export async function markConversationAsRead(
  db: SQLiteDatabase,
  conversationId: string,
  userId: string
): Promise<void> {
  // Get all unread messages in the conversation
  const unreadMessages = await db.getAllAsync<{ id: string }>(
    `
    SELECT m.id
    FROM messages m
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
    WHERE m.conversation_id = ?
      AND m.sender_id != ?
      AND mr.id IS NULL
      AND m.deleted_at IS NULL
  `,
    [userId, conversationId, userId]
  );

  // Mark each as read
  for (const message of unreadMessages) {
    await markMessageAsRead(db, message.id, userId);
  }
}

export async function updateMessage(
  db: SQLiteDatabase,
  messageId: string,
  content: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE messages SET content = ?, edited_at = ?, synced = 0 WHERE id = ?',
    content,
    now,
    messageId
  );

  const message = await getMessageById(db, messageId);
  if (message) {
    await enqueueSyncChange({
      type: 'message',
      action: 'update',
      entityId: messageId,
      data: {
        ...message,
        content,
        edited_at: now,
        deleted_at: message.deleted_at ?? null,
      },
      version: null,
    });
  }
}

export async function deleteMessage(
  db: SQLiteDatabase,
  messageId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE messages SET deleted_at = ?, synced = 0 WHERE id = ?',
    now,
    messageId
  );

  const message = await getMessageById(db, messageId);
  if (message) {
    await enqueueSyncChange({
      type: 'message',
      action: 'delete',
      entityId: messageId,
      data: {
        ...message,
        deleted_at: now,
      },
      version: null,
    });
  }
}

export async function getMessageById(
  db: SQLiteDatabase,
  messageId: string
): Promise<Message | null> {
  const row = await db.getFirstAsync<Message>(
    'SELECT * FROM messages WHERE id = ?',
    [messageId]
  );
  return row || null;
}
