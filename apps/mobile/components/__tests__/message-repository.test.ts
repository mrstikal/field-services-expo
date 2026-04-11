import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createMessage,
  deleteMessage,
  getMessagesByConversation,
  markConversationAsRead,
  markMessageAsRead,
  updateMessage,
} from '@lib/db/message-repository';

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('message-repository', () => {
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
       ('user-b', 'b@example.com', 'dispatcher', 'Bob', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );

    await db.runAsync(
      `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
       VALUES ('conv-1', 'user-a', 'user-b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)`
    );
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('getMessagesByConversation returns conversation messages with sender and read state', async () => {
    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES
       ('msg-1', 'conv-1', 'user-b', 'First', '2026-01-01T08:00:00.000Z', 0),
       ('msg-2', 'conv-1', 'user-a', 'Second', '2026-01-01T09:00:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO message_reads (id, message_id, user_id, read_at, synced)
       VALUES ('read-1', 'msg-1', 'user-a', '2026-01-01T09:05:00.000Z', 0)`
    );

    const result = await getMessagesByConversation(db, 'conv-1', 'user-a');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('msg-1');
    expect(result[0].sender.name).toBe('Bob');
    expect(result[0].is_read).toBe(true);
    expect(result[1].id).toBe('msg-2');
    expect(result[1].sender.name).toBe('Alice');
  });

  it('createMessage inserts a message', async () => {
    const created = await createMessage(db, 'conv-1', 'user-a', 'Hello world');

    const stored = await db.getFirstAsync<{ content: string; synced: number }>(
      'SELECT content, synced FROM messages WHERE id = ?',
      [created.id]
    );

    expect(stored?.content).toBe('Hello world');
    expect(stored?.synced).toBe(0);
  });

  it('markMessageAsRead marks once (idempotent)', async () => {
    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES ('msg-1', 'conv-1', 'user-b', 'Unread', '2026-01-01T08:00:00.000Z', 0)`
    );

    await markMessageAsRead(db, 'msg-1', 'user-a');
    await markMessageAsRead(db, 'msg-1', 'user-a');

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM message_reads WHERE message_id = ? AND user_id = ?',
      ['msg-1', 'user-a']
    );

    expect(result?.count).toBe(1);
  });

  it('markConversationAsRead marks all unread foreign messages', async () => {
    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES
       ('msg-unread', 'conv-1', 'user-b', 'Unread', '2026-01-01T08:00:00.000Z', 0),
       ('msg-read', 'conv-1', 'user-b', 'Read', '2026-01-01T08:10:00.000Z', 0),
       ('msg-own', 'conv-1', 'user-a', 'Own', '2026-01-01T08:20:00.000Z', 0)`
    );

    await db.runAsync(
      `INSERT INTO message_reads (id, message_id, user_id, read_at, synced)
       VALUES ('already-read', 'msg-read', 'user-a', '2026-01-01T08:30:00.000Z', 0)`
    );

    await markConversationAsRead(db, 'conv-1', 'user-a');

    const unreadRead = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM message_reads WHERE message_id = ? AND user_id = ?',
      ['msg-unread', 'user-a']
    );
    const ownRead = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM message_reads WHERE message_id = ? AND user_id = ?',
      ['msg-own', 'user-a']
    );

    expect(unreadRead?.count).toBe(1);
    expect(ownRead?.count).toBe(0);
  });

  it('updateMessage updates content and edited timestamp', async () => {
    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES ('msg-1', 'conv-1', 'user-a', 'Original', '2026-01-01T08:00:00.000Z', 1)`
    );

    await updateMessage(db, 'msg-1', 'Updated');

    const row = await db.getFirstAsync<{
      content: string;
      edited_at: string | null;
      synced: number;
    }>('SELECT content, edited_at, synced FROM messages WHERE id = ?', ['msg-1']);

    expect(row?.content).toBe('Updated');
    expect(row?.edited_at).toBeTruthy();
    expect(row?.synced).toBe(0);
  });

  it('deleteMessage soft deletes message', async () => {
    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, synced)
       VALUES ('msg-1', 'conv-1', 'user-a', 'To delete', '2026-01-01T08:00:00.000Z', 1)`
    );

    await deleteMessage(db, 'msg-1');

    const row = await db.getFirstAsync<{
      deleted_at: string | null;
      synced: number;
    }>('SELECT deleted_at, synced FROM messages WHERE id = ?', ['msg-1']);

    const visible = await getMessagesByConversation(db, 'conv-1', 'user-a');

    expect(row?.deleted_at).toBeTruthy();
    expect(row?.synced).toBe(0);
    expect(visible).toHaveLength(0);
  });
});
