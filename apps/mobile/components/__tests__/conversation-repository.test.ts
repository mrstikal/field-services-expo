import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  getAllConversations,
  getConversationById,
  getOrCreateConversation,
  getTotalUnreadCount,
  getUnreadConversations,
} from '@lib/db/conversation-repository';

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('conversation-repository', () => {
  let db: SQLiteDatabase;
  let getTestDatabase: (() => Promise<SQLiteDatabase>) | null = null;

  beforeEach(async () => {
    if (!getTestDatabase) {
      ({ getTestDatabase } = await import('@lib/db/local-database'));
    }
    db = await getTestDatabase();

    await db.runAsync(
      `INSERT INTO users (id, email, role, name, created_at, updated_at)
       VALUES
       ('user-a', 'a@example.com', 'technician', 'Alice', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
       ('user-b', 'b@example.com', 'dispatcher', 'Bob', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
       ('user-c', 'c@example.com', 'technician', 'Charlie', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('getAllConversations returns all conversations with details', async () => {
    await db.runAsync(
      `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
       VALUES
       ('conv-1', 'user-a', 'user-b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0),
       ('conv-2', 'user-a', 'user-c', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES
       ('msg-1', 'conv-1', 'user-b', 'Unread from Bob', '2026-01-01T09:00:00.000Z', 0),
       ('msg-2', 'conv-2', 'user-a', 'Latest own message', '2026-01-02T09:00:00.000Z', 0)`
    );

    const result = await getAllConversations(db, 'user-a');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('conv-2');
    expect(result[0].other_user.id).toBe('user-c');
    expect(result[0].last_message?.content).toBe('Latest own message');

    const unreadConversation = result.find(c => c.id === 'conv-1');
    expect(unreadConversation?.unread_count).toBe(1);
    expect(unreadConversation?.other_user.name).toBe('Bob');
  });

  it('getUnreadConversations filters only unread conversations', async () => {
    await db.runAsync(
      `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
       VALUES
       ('conv-read', 'user-a', 'user-b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0),
       ('conv-unread', 'user-a', 'user-c', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES
       ('msg-read', 'conv-read', 'user-b', 'Already read', '2026-01-01T08:00:00.000Z', 0),
       ('msg-unread', 'conv-unread', 'user-c', 'Still unread', '2026-01-01T09:00:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO message_reads (id, message_id, user_id, read_at, synced)
       VALUES ('read-1', 'msg-read', 'user-a', '2026-01-01T10:00:00.000Z', 0)`
    );

    const result = await getUnreadConversations(db, 'user-a');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('conv-unread');
  });

  it('getConversationById returns one conversation', async () => {
    await db.runAsync(
      `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
       VALUES ('conv-1', 'user-a', 'user-b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)`
    );

    const found = await getConversationById(db, 'conv-1');
    const missing = await getConversationById(db, 'conv-missing');

    expect(found?.id).toBe('conv-1');
    expect(missing).toBeNull();
  });

  it('getOrCreateConversation creates or reuses conversation', async () => {
    const created = await getOrCreateConversation(db, 'user-c', 'user-a');
    expect(created.user1_id).toBe('user-a');
    expect(created.user2_id).toBe('user-c');

    const existing = await getOrCreateConversation(db, 'user-a', 'user-c');
    expect(existing.id).toBe(created.id);

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
      ['user-a', 'user-c', 'user-c', 'user-a']
    );

    expect(count?.count).toBe(1);
  });

  it('getTotalUnreadCount counts only unread foreign non-deleted messages', async () => {
    await db.runAsync(
      `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
       VALUES ('conv-1', 'user-a', 'user-b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, deleted_at, synced)
       VALUES
       ('msg-unread', 'conv-1', 'user-b', 'Unread', '2026-01-01T08:00:00.000Z', NULL, 0),
       ('msg-read', 'conv-1', 'user-b', 'Read', '2026-01-01T08:05:00.000Z', NULL, 0),
       ('msg-own', 'conv-1', 'user-a', 'Own', '2026-01-01T08:10:00.000Z', NULL, 0),
       ('msg-deleted', 'conv-1', 'user-b', 'Deleted', '2026-01-01T08:15:00.000Z', '2026-01-01T09:00:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO message_reads (id, message_id, user_id, read_at, synced)
       VALUES ('read-msg', 'msg-read', 'user-a', '2026-01-01T09:00:00.000Z', 0)`
    );

    const unread = await getTotalUnreadCount(db, 'user-a');
    expect(unread).toBe(1);
  });
});
