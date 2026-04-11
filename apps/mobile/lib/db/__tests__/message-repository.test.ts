import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOrCreateConversation } from '../conversation-repository';
import {
  getMessagesByConversation,
  createMessage,
  markMessageAsRead,
  markConversationAsRead,
  updateMessage,
  deleteMessage,
  getMessageById,
} from '../message-repository';
import type { SQLiteDatabase } from 'expo-sqlite';

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('message-repository', () => {
  let db: SQLiteDatabase;
  let getTestDatabase: (() => Promise<SQLiteDatabase>) | null = null;
  const user1Id = 'user-1';
  const user2Id = 'user-2';
  let conversationId: string;

  beforeEach(async () => {
    if (!getTestDatabase) {
      ({ getTestDatabase } = await import('../local-database'));
    }
    db = await getTestDatabase();

    // Insert test users
    await db.runAsync(
      `INSERT INTO users (id, email, role, name, phone, created_at, updated_at) VALUES 
       (?, 'user1@test.com', 'technician', 'User One', '+420111', datetime('now'), datetime('now')),
       (?, 'user2@test.com', 'dispatcher', 'User Two', '+420222', datetime('now'), datetime('now'))`,
      [user1Id, user2Id]
    );

    // Create a conversation
    const conversation = await getOrCreateConversation(db, user1Id, user2Id);
    conversationId = conversation.id;
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('createMessage', () => {
    it('should create a new message', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Test message');

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.conversation_id).toBe(conversationId);
      expect(message.sender_id).toBe(user1Id);
      expect(message.content).toBe('Test message');
      expect(message.sent_at).toBeDefined();
    });

    it('should create message with current timestamp', async () => {
      const before = new Date().toISOString();
      const message = await createMessage(db, conversationId, user1Id, 'Test');
      const after = new Date().toISOString();

      expect(message.sent_at >= before).toBe(true);
      expect(message.sent_at <= after).toBe(true);
    });
  });

  describe('getMessageById', () => {
    it('should return message by id', async () => {
      const created = await createMessage(db, conversationId, user1Id, 'Test');
      const found = await getMessageById(db, created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.content).toBe('Test');
    });

    it('should return null for non-existent message', async () => {
      const found = await getMessageById(db, 'non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getMessagesByConversation', () => {
    it('should return empty array when no messages', async () => {
      const messages = await getMessagesByConversation(db, conversationId, user1Id);
      expect(messages).toEqual([]);
    });

    it('should return messages in chronological order', async () => {
      await createMessage(db, conversationId, user1Id, 'First');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createMessage(db, conversationId, user2Id, 'Second');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createMessage(db, conversationId, user1Id, 'Third');

      const messages = await getMessagesByConversation(db, conversationId, user1Id);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    it('should include sender information', async () => {
      await createMessage(db, conversationId, user1Id, 'Test');

      const messages = await getMessagesByConversation(db, conversationId, user1Id);

      expect(messages[0].sender).toBeDefined();
      expect(messages[0].sender.id).toBe(user1Id);
      expect(messages[0].sender.name).toBe('User One');
    });

    it('should include read status', async () => {
      const message = await createMessage(db, conversationId, user2Id, 'Test');

      let messages = await getMessagesByConversation(db, conversationId, user1Id);
      expect(messages[0].is_read).toBe(false);

      await markMessageAsRead(db, message.id, user1Id);

      messages = await getMessagesByConversation(db, conversationId, user1Id);
      expect(messages[0].is_read).toBe(true);
    });

    it('should not return deleted messages', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Test');
      await deleteMessage(db, message.id);

      const messages = await getMessagesByConversation(db, conversationId, user1Id);
      expect(messages).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await createMessage(db, conversationId, user1Id, `Message ${i}`);
      }

      const messages = await getMessagesByConversation(db, conversationId, user1Id, 3);
      expect(messages).toHaveLength(3);
    });

    it('should respect offset parameter', async () => {
      await createMessage(db, conversationId, user1Id, 'First');
      await createMessage(db, conversationId, user1Id, 'Second');
      await createMessage(db, conversationId, user1Id, 'Third');

      const messages = await getMessagesByConversation(db, conversationId, user1Id, 50, 1);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Second');
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read', async () => {
      const message = await createMessage(db, conversationId, user2Id, 'Test');

      await markMessageAsRead(db, message.id, user1Id);

      const read = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM message_reads WHERE message_id = ? AND user_id = ?',
        [message.id, user1Id]
      );

      expect(read).toBeDefined();
    });

    it('should not create duplicate read records', async () => {
      const message = await createMessage(db, conversationId, user2Id, 'Test');

      await markMessageAsRead(db, message.id, user1Id);
      await markMessageAsRead(db, message.id, user1Id);

      const reads = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM message_reads WHERE message_id = ? AND user_id = ?',
        [message.id, user1Id]
      );

      expect(reads).toHaveLength(1);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all unread messages as read', async () => {
      await createMessage(db, conversationId, user2Id, 'Message 1');
      await createMessage(db, conversationId, user2Id, 'Message 2');
      await createMessage(db, conversationId, user2Id, 'Message 3');

      await markConversationAsRead(db, conversationId, user1Id);

      const messages = await getMessagesByConversation(db, conversationId, user1Id);
      expect(messages.every(m => m.is_read)).toBe(true);
    });

    it('should not mark own messages', async () => {
      await createMessage(db, conversationId, user1Id, 'Own message');
      await createMessage(db, conversationId, user2Id, 'Other message');

      await markConversationAsRead(db, conversationId, user1Id);

      const reads = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM message_reads WHERE user_id = ?',
        [user1Id]
      );

      // Should only have 1 read record (for the message from user2)
      expect(reads).toHaveLength(1);
    });

    it('should not mark already read messages again', async () => {
      const message = await createMessage(db, conversationId, user2Id, 'Test');
      await markMessageAsRead(db, message.id, user1Id);

      await markConversationAsRead(db, conversationId, user1Id);

      const reads = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM message_reads WHERE message_id = ?',
        [message.id]
      );

      expect(reads).toHaveLength(1);
    });
  });

  describe('updateMessage', () => {
    it('should update message content', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Original');

      await updateMessage(db, message.id, 'Updated');

      const updated = await getMessageById(db, message.id);
      expect(updated?.content).toBe('Updated');
    });

    it('should set edited_at timestamp', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Original');

      await updateMessage(db, message.id, 'Updated');

      const updated = await getMessageById(db, message.id);
      expect(updated?.edited_at).toBeDefined();
      expect(updated?.edited_at).not.toBeNull();
    });

    it('should mark as not synced', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Original');

      // Mark as synced
      await db.runAsync('UPDATE messages SET synced = 1 WHERE id = ?', [message.id]);

      await updateMessage(db, message.id, 'Updated');

      const updated = await db.getFirstAsync<{ synced: number }>(
        'SELECT synced FROM messages WHERE id = ?',
        [message.id]
      );

      expect(updated?.synced).toBe(0);
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete message', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Test');

      await deleteMessage(db, message.id);

      const deleted = await getMessageById(db, message.id);
      expect(deleted?.deleted_at).toBeDefined();
      expect(deleted?.deleted_at).not.toBeNull();
    });

    it('should not return deleted messages in queries', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Test');
      await deleteMessage(db, message.id);

      const messages = await getMessagesByConversation(db, conversationId, user1Id);
      expect(messages).toHaveLength(0);
    });

    it('should mark as not synced', async () => {
      const message = await createMessage(db, conversationId, user1Id, 'Test');

      // Mark as synced
      await db.runAsync('UPDATE messages SET synced = 1 WHERE id = ?', [message.id]);

      await deleteMessage(db, message.id);

      const deleted = await db.getFirstAsync<{ synced: number }>(
        'SELECT synced FROM messages WHERE id = ?',
        [message.id]
      );

      expect(deleted?.synced).toBe(0);
    });
  });
});