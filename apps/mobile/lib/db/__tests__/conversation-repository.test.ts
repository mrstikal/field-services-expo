import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAllConversations,
  getUnreadConversations,
  getConversationById,
  getOrCreateConversation,
  getTotalUnreadCount,
  updateConversationTimestamp,
} from '../conversation-repository';
import { createMessage } from '../message-repository';
import type { SQLiteDatabase } from 'expo-sqlite';

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('conversation-repository', () => {
  let db: SQLiteDatabase;
  let getTestDatabase: (() => Promise<SQLiteDatabase>) | null = null;
  const user1Id = 'user-1';
  const user2Id = 'user-2';
  const user3Id = 'user-3';

  beforeEach(async () => {
    if (!getTestDatabase) {
      ({ getTestDatabase } = await import('../local-database'));
    }
    db = await getTestDatabase();

    // Insert test users
    await db.runAsync(
      `INSERT INTO users (id, email, role, name, phone, created_at, updated_at) VALUES 
       (?, 'user1@test.com', 'technician', 'User One', '+420111', datetime('now'), datetime('now')),
       (?, 'user2@test.com', 'dispatcher', 'User Two', '+420222', datetime('now'), datetime('now')),
       (?, 'user3@test.com', 'technician', 'User Three', '+420333', datetime('now'), datetime('now'))`,
      [user1Id, user2Id, user3Id]
    );
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('getOrCreateConversation', () => {
    it('should create a new conversation', async () => {
      const conversation = await getOrCreateConversation(db, user1Id, user2Id);

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
      expect([conversation.user1_id, conversation.user2_id]).toContain(user1Id);
      expect([conversation.user1_id, conversation.user2_id]).toContain(user2Id);
    });

    it('should return existing conversation', async () => {
      const conv1 = await getOrCreateConversation(db, user1Id, user2Id);
      const conv2 = await getOrCreateConversation(db, user1Id, user2Id);

      expect(conv1.id).toBe(conv2.id);
    });

    it('should return same conversation regardless of user order', async () => {
      const conv1 = await getOrCreateConversation(db, user1Id, user2Id);
      const conv2 = await getOrCreateConversation(db, user2Id, user1Id);

      expect(conv1.id).toBe(conv2.id);
    });
  });

  describe('getConversationById', () => {
    it('should return conversation by id', async () => {
      const created = await getOrCreateConversation(db, user1Id, user2Id);
      const found = await getConversationById(db, created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent conversation', async () => {
      const found = await getConversationById(db, 'non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getAllConversations', () => {
    it('should return empty array when no conversations', async () => {
      const conversations = await getAllConversations(db, user1Id);
      expect(conversations).toEqual([]);
    });

    it('should return conversations for user', async () => {
      await getOrCreateConversation(db, user1Id, user2Id);
      await getOrCreateConversation(db, user1Id, user3Id);

      const conversations = await getAllConversations(db, user1Id);

      expect(conversations).toHaveLength(2);
      expect(conversations[0].other_user).toBeDefined();
    });

    it('should include unread count', async () => {
      const conv = await getOrCreateConversation(db, user1Id, user2Id);
      await createMessage(db, conv.id, user2Id, 'Test message');

      const conversations = await getAllConversations(db, user1Id);

      expect(conversations[0].unread_count).toBe(1);
    });

    it('should include last message', async () => {
      const conv = await getOrCreateConversation(db, user1Id, user2Id);
      const message = await createMessage(db, conv.id, user2Id, 'Last message');

      const conversations = await getAllConversations(db, user1Id);

      expect(conversations[0].last_message).toBeDefined();
      expect(conversations[0].last_message?.content).toBe('Last message');
    });

    it('should order by most recent activity', async () => {
      const conv1 = await getOrCreateConversation(db, user1Id, user2Id);
      const conv2 = await getOrCreateConversation(db, user1Id, user3Id);

      // Add message to conv1 (making it more recent)
      await createMessage(db, conv1.id, user2Id, 'Recent message');

      const conversations = await getAllConversations(db, user1Id);

      expect(conversations[0].id).toBe(conv1.id);
      expect(conversations[1].id).toBe(conv2.id);
    });
  });

  describe('getUnreadConversations', () => {
    it('should return only conversations with unread messages', async () => {
      const conv1 = await getOrCreateConversation(db, user1Id, user2Id);
      const conv2 = await getOrCreateConversation(db, user1Id, user3Id);

      // Add unread message to conv1
      await createMessage(db, conv1.id, user2Id, 'Unread message');

      const unread = await getUnreadConversations(db, user1Id);

      expect(unread).toHaveLength(1);
      expect(unread[0].id).toBe(conv1.id);
      expect(unread[0].unread_count).toBeGreaterThan(0);
    });

    it('should return empty array when all messages are read', async () => {
      const conv = await getOrCreateConversation(db, user1Id, user2Id);
      const message = await createMessage(db, conv.id, user2Id, 'Message');

      // Mark as read
      await db.runAsync(
        'INSERT INTO message_reads (id, message_id, user_id, read_at, synced) VALUES (?, ?, ?, datetime("now"), 0)',
        [crypto.randomUUID(), message.id, user1Id]
      );

      const unread = await getUnreadConversations(db, user1Id);
      expect(unread).toHaveLength(0);
    });
  });

  describe('getTotalUnreadCount', () => {
    it('should return 0 when no unread messages', async () => {
      const count = await getTotalUnreadCount(db, user1Id);
      expect(count).toBe(0);
    });

    it('should count unread messages across all conversations', async () => {
      const conv1 = await getOrCreateConversation(db, user1Id, user2Id);
      const conv2 = await getOrCreateConversation(db, user1Id, user3Id);

      await createMessage(db, conv1.id, user2Id, 'Message 1');
      await createMessage(db, conv1.id, user2Id, 'Message 2');
      await createMessage(db, conv2.id, user3Id, 'Message 3');

      const count = await getTotalUnreadCount(db, user1Id);
      expect(count).toBe(3);
    });

    it('should not count own messages', async () => {
      const conv = await getOrCreateConversation(db, user1Id, user2Id);
      await createMessage(db, conv.id, user1Id, 'Own message');

      const count = await getTotalUnreadCount(db, user1Id);
      expect(count).toBe(0);
    });

    it('should not count deleted messages', async () => {
      const conv = await getOrCreateConversation(db, user1Id, user2Id);
      const message = await createMessage(db, conv.id, user2Id, 'Message');

      // Mark as deleted
      await db.runAsync(
        'UPDATE messages SET deleted_at = datetime("now") WHERE id = ?',
        [message.id]
      );

      const count = await getTotalUnreadCount(db, user1Id);
      expect(count).toBe(0);
    });
  });

  describe('updateConversationTimestamp', () => {
    it('should update conversation timestamp', async () => {
      const conv = await getOrCreateConversation(db, user1Id, user2Id);
      const originalTimestamp = conv.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await updateConversationTimestamp(db, conv.id);

      const updated = await getConversationById(db, conv.id);
      expect(updated?.updated_at).not.toBe(originalTimestamp);
    });
  });
});