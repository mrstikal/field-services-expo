import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Conversation,
  ConversationWithDetails,
} from '@field-service/shared-types';
import { enqueueSyncChange } from '@/lib/sync/sync-events';
import { generateId } from '@/lib/utils/generate-id';

export async function getAllConversations(
  db: SQLiteDatabase,
  userId: string
): Promise<ConversationWithDetails[]> {
  const rows = await db.getAllAsync<{
    id: string;
    user1_id: string;
    user2_id: string;
    created_at: string;
    updated_at: string;
    other_user_id: string;
    other_user_name: string;
    other_user_email: string;
    other_user_avatar_url: string | null;
    other_user_role: string;
    last_message_id: string | null;
    last_message_content: string | null;
    last_message_sent_at: string | null;
    unread_count: number;
  }>(
    `
    SELECT 
      c.*,
      CASE 
        WHEN c.user1_id = ? THEN c.user2_id 
        ELSE c.user1_id 
      END as other_user_id,
      u.name as other_user_name,
      u.email as other_user_email,
      u.avatar_url as other_user_avatar_url,
      u.role as other_user_role,
      lm.id as last_message_id,
      lm.content as last_message_content,
      lm.sent_at as last_message_sent_at,
      (
        SELECT COUNT(*)
        FROM messages m
        LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
        WHERE m.conversation_id = c.id
          AND m.sender_id != ?
          AND mr.id IS NULL
          AND m.deleted_at IS NULL
      ) as unread_count
    FROM conversations c
    LEFT JOIN (
      SELECT conversation_id, id, content, sent_at
      FROM messages
      WHERE deleted_at IS NULL
      ORDER BY sent_at DESC
    ) lm ON lm.conversation_id = c.id
    LEFT JOIN users u ON u.id = CASE 
      WHEN c.user1_id = ? THEN c.user2_id 
      ELSE c.user1_id 
    END
    WHERE c.user1_id = ? OR c.user2_id = ?
    GROUP BY c.id
    ORDER BY COALESCE(lm.sent_at, c.updated_at) DESC
  `,
    [userId, userId, userId, userId, userId, userId]
  );

  return rows.map(row => ({
    id: row.id,
    user1_id: row.user1_id,
    user2_id: row.user2_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    other_user: {
      id: row.other_user_id,
      name: row.other_user_name || 'Unknown User',
      email: row.other_user_email,
      avatar_url: row.other_user_avatar_url,
      role: row.other_user_role as 'technician' | 'dispatcher',
    },
    last_message: row.last_message_id
      ? {
          id: row.last_message_id,
          conversation_id: row.id,
          sender_id:
            row.last_message_sent_at === row.updated_at
              ? row.other_user_id
              : userId,
          content: row.last_message_content!,
          sent_at: row.last_message_sent_at!,
        }
      : undefined,
    unread_count: row.unread_count,
  }));
}

export async function getUnreadConversations(
  db: SQLiteDatabase,
  userId: string
): Promise<ConversationWithDetails[]> {
  const all = await getAllConversations(db, userId);
  return all.filter(c => c.unread_count > 0);
}

export async function getConversationById(
  db: SQLiteDatabase,
  conversationId: string
): Promise<Conversation | null> {
  const row = await db.getFirstAsync<Conversation>(
    'SELECT * FROM conversations WHERE id = ?',
    [conversationId]
  );
  return row || null;
}

export async function getOrCreateConversation(
  db: SQLiteDatabase,
  user1Id: string,
  user2Id: string
): Promise<Conversation> {
  // Ensure consistent ordering (smaller ID first)
  const [userId1, userId2] =
    user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

  // Try to find existing conversation
  const existing = await db.getFirstAsync<Conversation>(
    `SELECT * FROM conversations 
     WHERE (user1_id = ? AND user2_id = ?) 
        OR (user1_id = ? AND user2_id = ?)`,
    [userId1, userId2, userId2, userId1]
  );

  if (existing) {
    return existing;
  }

  // Create new conversation
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    id,
    userId1,
    userId2,
    now,
    now
  );

  await enqueueSyncChange({
    type: 'conversation',
    action: 'create',
    entityId: id,
    data: {
      id,
      user1_id: userId1,
      user2_id: userId2,
      created_at: now,
      updated_at: now,
    },
    version: null,
  });

  return {
    id,
    user1_id: userId1,
    user2_id: userId2,
    created_at: now,
    updated_at: now,
  };
}

export async function updateConversationTimestamp(
  db: SQLiteDatabase,
  conversationId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE conversations SET updated_at = ? WHERE id = ?',
    now,
    conversationId
  );
}

export async function getTotalUnreadCount(
  db: SQLiteDatabase,
  userId: string
): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    `
    SELECT COUNT(DISTINCT m.id) as count
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
    WHERE (c.user1_id = ? OR c.user2_id = ?)
      AND m.sender_id != ?
      AND mr.id IS NULL
      AND m.deleted_at IS NULL
  `,
    [userId, userId, userId, userId]
  );

  return result?.count || 0;
}
