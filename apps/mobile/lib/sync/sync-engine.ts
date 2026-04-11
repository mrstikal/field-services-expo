import { supabase } from '@/lib/supabase';
import { upsertChatUsers } from '@/lib/db/chat-user-repository';
import { taskRepository } from '@/lib/db/task-repository';
import { reportRepository } from '@/lib/db/report-repository';
import { locationRepository } from '@/lib/db/location-repository';
import { getDatabase } from '@/lib/db/local-database';
import {
  clearPendingChangesForEntity,
  emitSyncEvent,
} from '@/lib/sync/sync-events';
import type {
  Conversation,
  Location,
  Message,
  MessageRead,
  Report,
  SyncChange,
  Task,
} from '@field-service/shared-types';

export class SyncNetworkUnavailableError extends Error {
  readonly apiUrl: string;

  constructor(apiUrl: string, cause?: unknown) {
    super(`Sync backend is unreachable at ${apiUrl}`);
    this.name = 'SyncNetworkUnavailableError';
    this.apiUrl = apiUrl;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class SyncAuthUnavailableError extends Error {
  constructor() {
    super('No auth token available');
    this.name = 'SyncAuthUnavailableError';
  }
}

interface SyncQueueItem {
  id: string;
  type:
    | 'task'
    | 'report'
    | 'location'
    | 'conversation'
    | 'message'
    | 'message_read';
  action: 'create' | 'update' | 'delete';
  entity_id: string;
  data: string | Record<string, unknown>;
  version: number | null;
  status: 'pending' | 'synced' | 'failed';
  error?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface PushItemResult {
  id: string;
  status: 'success' | 'failed' | 'conflict';
  error?: string;
  record?: Record<string, unknown>;
  serverRecord?: Record<string, unknown>;
}

let syncEngineInstance: SyncEngine | null = null;

export class SyncEngine {
  private lastSyncTimestamp: string | null = null;
  private syncInProgress = false;

  public isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  public beginSync(): boolean {
    if (this.syncInProgress) return false;
    this.syncInProgress = true;
    return true;
  }

  public endSync(): void {
    this.syncInProgress = false;
  }

  static getInstance(): SyncEngine {
    if (!syncEngineInstance) {
      syncEngineInstance = new SyncEngine();
    }
    return syncEngineInstance;
  }

  async initialize(): Promise<void> {
    this.lastSyncTimestamp = await taskRepository.getLastSyncTimestamp();
  }

  private async getAuthToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token || null;
    if (!token) {
      throw new SyncAuthUnavailableError();
    }
    return token;
  }

  private async makeApiRequest(url: string, options: RequestInit = {}) {
    const token = await this.getAuthToken();

    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const apiUrl = `${apiBaseUrl}${url}`;

    let response: Response;

    try {
      response = await fetch(apiUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
    } catch (error) {
      // Catch network-related errors during transition
      if (
        error instanceof Error &&
        (error.message.includes('Network request failed') ||
          error.name === 'TypeError')
      ) {
        throw new SyncNetworkUnavailableError(apiUrl, error);
      }
      throw error;
    }

    const payload =
      typeof response.json === 'function'
        ? await response.json().catch(() => ({}))
        : {};

    if (!response.ok) {
      throw new Error(
        payload.error ||
          `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return payload;
  }

  async pullSync(): Promise<{
    tasks: number;
    reports: number;
    locations: number;
  }> {
    const result = { tasks: 0, reports: 0, locations: 0 };
    const lastSync = this.lastSyncTimestamp || new Date(0).toISOString();

    const response = await this.makeApiRequest('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ lastSyncTimestamp: lastSync }),
    });
    const responseError =
      typeof response.error === 'string' ? response.error : undefined;

    if (!response.success) {
      throw new Error(responseError || 'Pull sync API call failed');
    }

    const { data } = response;

    for (const task of (data.tasks ?? []) as Task[]) {
      await this.processServerTask(task);
      result.tasks++;
    }

    for (const report of (data.reports ?? []) as Report[]) {
      await this.processServerReport(report);
      result.reports++;
    }

    for (const location of (data.locations ?? []) as Location[]) {
      await locationRepository.upsertFromServer(location);
      result.locations++;
    }

    await upsertChatUsers(getDatabase(), data.chatUsers ?? []);

    for (const conversation of (data.conversations ?? []) as Conversation[]) {
      await this.processServerConversation(conversation);
    }

    for (const message of (data.messages ?? []) as Message[]) {
      await this.processServerMessage(message);
    }

    for (const messageRead of (data.messageReads ?? []) as MessageRead[]) {
      await this.processServerMessageRead(messageRead);
    }

    const serverTimestamp = data.serverTimestamp || new Date().toISOString();
    await taskRepository.setLastSyncTimestamp(serverTimestamp);
    this.lastSyncTimestamp = serverTimestamp;
    emitSyncEvent();

    return result;
  }

  private async processServerTask(serverTask: Task) {
    const localTask = await taskRepository.getById(serverTask.id, {
      includeDeleted: true,
    });
    const hasPendingChanges = await this.hasPendingChanges(
      'task',
      serverTask.id
    );

    if (localTask && hasPendingChanges) {
      await taskRepository.resolveConflict(localTask, serverTask);
      return;
    }

    await taskRepository.upsertFromServer(serverTask);
  }

  private async processServerReport(serverReport: Report) {
    const localReport = await reportRepository.getById(serverReport.id, {
      includeDeleted: true,
    });
    const hasPendingChanges = await this.hasPendingChanges(
      'report',
      serverReport.id
    );

    if (localReport && hasPendingChanges) {
      await reportRepository.resolveConflict(localReport, serverReport);
      return;
    }

    await reportRepository.upsertFromServer(serverReport);
  }

  private async processServerConversation(serverConversation: Conversation) {
    const db = getDatabase();

    await db.runAsync(
      `INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         user1_id = excluded.user1_id,
         user2_id = excluded.user2_id,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         synced = 1`,
      [
        serverConversation.id,
        serverConversation.user1_id,
        serverConversation.user2_id,
        serverConversation.created_at,
        serverConversation.updated_at,
      ]
    );

    await clearPendingChangesForEntity('conversation', serverConversation.id);
  }

  private async processServerMessage(serverMessage: Message) {
    const db = getDatabase();

    await db.runAsync(
      `INSERT INTO messages (
        id, conversation_id, sender_id, content, sent_at, edited_at, deleted_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        conversation_id = excluded.conversation_id,
        sender_id = excluded.sender_id,
        content = excluded.content,
        sent_at = excluded.sent_at,
        edited_at = excluded.edited_at,
        deleted_at = excluded.deleted_at,
        synced = 1`,
      [
        serverMessage.id,
        serverMessage.conversation_id,
        serverMessage.sender_id,
        serverMessage.content,
        serverMessage.sent_at,
        serverMessage.edited_at ?? null,
        serverMessage.deleted_at ?? null,
      ]
    );

    await clearPendingChangesForEntity('message', serverMessage.id);
  }

  private async processServerMessageRead(serverMessageRead: MessageRead) {
    const db = getDatabase();

    await db.runAsync(
      `INSERT INTO message_reads (id, message_id, user_id, read_at, synced)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(message_id, user_id) DO UPDATE SET
         id = excluded.id,
         read_at = excluded.read_at,
         synced = 1`,
      [
        serverMessageRead.id,
        serverMessageRead.message_id,
        serverMessageRead.user_id,
        serverMessageRead.read_at,
      ]
    );

    await clearPendingChangesForEntity('message_read', serverMessageRead.id);
  }

  private async hasPendingChanges(
    type: SyncQueueItem['type'],
    entityId: string
  ) {
    const db = getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE type = ? AND entity_id = ? AND status IN ('pending', 'failed')`,
      [type, entityId]
    );

    return (result?.count ?? 0) > 0;
  }

  private mapQueueItemToSyncChange(item: SyncQueueItem): SyncChange {
    return {
      id: item.id,
      type: item.type,
      action: item.action,
      entityId: item.entity_id,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data,
      version: item.version,
    };
  }

  private async reconcileConversationId(
    localConversationId: string,
    serverConversationId: string
  ) {
    if (localConversationId === serverConversationId) {
      return;
    }

    const db = getDatabase();

    await db.runAsync(
      'UPDATE conversations SET id = ? WHERE id = ?',
      serverConversationId,
      localConversationId
    );
    await db.runAsync(
      'UPDATE messages SET conversation_id = ? WHERE conversation_id = ?',
      serverConversationId,
      localConversationId
    );

    const queueRows =
      (await db.getAllAsync<{
        id: string;
        type: string;
        entity_id: string;
        data: string;
      }>(
        `SELECT id, type, entity_id, data
         FROM sync_queue
         WHERE status IN ('pending', 'failed')`
      )) ?? [];

    for (const row of queueRows) {
      let nextEntityId = row.entity_id;
      let nextData = row.data;

      if (row.type === 'conversation' && row.entity_id === localConversationId) {
        nextEntityId = serverConversationId;
      }

      try {
        const parsed =
          typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

        if (parsed && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          let changed = false;

          if (record.id === localConversationId && row.type === 'conversation') {
            record.id = serverConversationId;
            changed = true;
          }

          if (record.conversation_id === localConversationId) {
            record.conversation_id = serverConversationId;
            changed = true;
          }

          if (changed) {
            nextData = JSON.stringify(record);
          }
        }
      } catch {
        // Keep the stored payload unchanged when it cannot be parsed.
      }

      if (nextEntityId !== row.entity_id || nextData !== row.data) {
        await db.runAsync(
          'UPDATE sync_queue SET entity_id = ?, data = ? WHERE id = ?',
          nextEntityId,
          nextData,
          row.id
        );
      }
    }
  }

  async pushSync(): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const db = getDatabase();
    const result = { success: 0, failed: 0, errors: [] as string[] };

    const queueItems =
      (await db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC`,
        ['pending']
      )) ?? [];

    if (!queueItems.length) {
      return result;
    }

    const changes: SyncChange[] = queueItems.map(item =>
      this.mapQueueItemToSyncChange(item)
    );

    const response = await this.makeApiRequest('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes }),
    });
    const responseError =
      typeof response.error === 'string' ? response.error : undefined;

    if (!response.success) {
      throw new Error(responseError || 'Push sync API call failed');
    }

    const itemResults = (response.results?.itemResults ??
      []) as PushItemResult[];
    const queueItemsById = new Map(queueItems.map(item => [item.id, item]));
    const processedItemIds = new Set<string>();

    for (const itemResult of itemResults) {
      const queueItem = queueItemsById.get(itemResult.id);
      if (!queueItem) continue;
      processedItemIds.add(queueItem.id);

      if (itemResult.status === 'success') {
        await this.handleSuccessfulPush(queueItem, itemResult.record);
        result.success++;
        continue;
      }

      if (itemResult.status === 'conflict') {
        const resolved = await this.handleConflictPush(
          queueItem,
          itemResult.serverRecord
        );
        if (resolved) {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(
            'Conflict returned without a server record.'
          );
        }
        continue;
      }

      const message =
        itemResult.error ||
        responseError ||
        `Sync failed for queue item ${queueItem.id}`;
      await this.updateSyncQueueStatus(queueItem.id, 'failed', message);
      result.failed++;
      result.errors.push(message);
    }

    for (const queueItem of queueItems) {
      if (processedItemIds.has(queueItem.id)) {
        continue;
      }

      const message =
        responseError ||
        `Push response missing result for queue item ${queueItem.id}`;
      await this.updateSyncQueueStatus(queueItem.id, 'failed', message);
      result.failed++;
      result.errors.push(message);
    }

    emitSyncEvent();
    return result;
  }

  private async handleSuccessfulPush(
    queueItem: SyncQueueItem,
    record?: Record<string, unknown>
  ) {
    if (!record) {
      await this.updateSyncQueueStatus(queueItem.id, 'synced');
      return;
    }

    switch (queueItem.type) {
      case 'task':
        await taskRepository.upsertFromServer(record as Task);
        break;
      case 'report':
        await reportRepository.upsertFromServer(record as Report);
        break;
      case 'location':
        await locationRepository.upsertFromServer(record as Location);
        break;
      case 'conversation': {
        const serverConversationId =
          typeof record.id === 'string' ? record.id : queueItem.entity_id;
        await this.reconcileConversationId(
          queueItem.entity_id,
          serverConversationId
        );
        break;
      }
      case 'message':
      case 'message_read':
        break;
    }

    await this.updateSyncQueueStatus(queueItem.id, 'synced');
  }

  private async handleConflictPush(
    queueItem: SyncQueueItem,
    serverRecord?: Record<string, unknown>
  ): Promise<boolean> {
    if (!serverRecord) {
      await this.updateSyncQueueStatus(
        queueItem.id,
        'failed',
        'Conflict returned without a server record.'
      );
      return false;
    }

    switch (queueItem.type) {
      case 'task': {
        const localTask = await taskRepository.getById(queueItem.entity_id, {
          includeDeleted: true,
        });
        if (localTask) {
          await taskRepository.resolveConflict(localTask, serverRecord as Task);
        } else {
          await taskRepository.upsertFromServer(serverRecord as Task);
        }
        break;
      }
      case 'report': {
        const localReport = await reportRepository.getById(
          queueItem.entity_id,
          { includeDeleted: true }
        );
        if (localReport) {
          await reportRepository.resolveConflict(
            localReport,
            serverRecord as Report
          );
        } else {
          await reportRepository.upsertFromServer(serverRecord as Report);
        }
        break;
      }
      case 'location':
        await locationRepository.upsertFromServer(serverRecord as Location);
        break;
      case 'conversation':
      case 'message':
      case 'message_read':
        break;
    }

    await this.updateSyncQueueStatus(queueItem.id, 'synced');
    return true;
  }

  private async updateSyncQueueStatus(
    id: string,
    status: 'pending' | 'synced' | 'failed',
    error?: string,
    incrementRetry = false
  ) {
    const db = getDatabase();
    const now = new Date().toISOString();

    if (incrementRetry) {
      await db.runAsync(
        `UPDATE sync_queue SET status = ?, error = ?, retry_count = retry_count + 1, updated_at = ? WHERE id = ?`,
        [status, error ?? null, now, id]
      );
      return;
    }

    await db.runAsync(
      `UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
      [status, error ?? null, now, id]
    );
  }

  async fullSync(): Promise<{
    pulled: { tasks: number; reports: number; locations: number };
    pushed: { success: number; failed: number; errors: string[] };
  }> {
    const pushed = await this.pushSync();
    const pulled = await this.pullSync();
    return { pulled, pushed };
  }

  async getStatus(): Promise<{
    lastSync: string | null;
    pendingItems: number;
    failedItems: number;
    latestFailedError: string | null;
  }> {
    const lastSync = await taskRepository.getLastSyncTimestamp();
    const db = getDatabase();
    const pendingResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?',
      ['pending']
    );
    const failedResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?',
      ['failed']
    );
    const latestFailed = await db.getFirstAsync<{ error: string | null }>(
      `SELECT error FROM sync_queue
       WHERE status = 'failed'
       ORDER BY updated_at DESC
       LIMIT 1`
    );
    return {
      lastSync,
      pendingItems: pendingResult?.count || 0,
      failedItems: failedResult?.count || 0,
      latestFailedError: latestFailed?.error ?? null,
    };
  }

  async cleanupSyncQueue(
    olderThanDays: number = 7
  ): Promise<{
    syncedRemoved: number;
    failedRemoved: number;
    totalRemoved: number;
  }> {
    const db = getDatabase();
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const syncedCountResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['synced', cutoffDate]
    );
    const failedCountResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['failed', cutoffDate]
    );

    await db.runAsync(
      `DELETE FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['synced', cutoffDate]
    );
    await db.runAsync(
      `DELETE FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['failed', cutoffDate]
    );
    emitSyncEvent();

    const syncedRemoved = syncedCountResult?.count || 0;
    const failedRemoved = failedCountResult?.count || 0;
    return {
      syncedRemoved,
      failedRemoved,
      totalRemoved: syncedRemoved + failedRemoved,
    };
  }

  async retryFailedSyncItems(
    maxRetries: number = 3
  ): Promise<{ retried: number; success: number; failed: number }> {
    const db = getDatabase();
    const result = { retried: 0, success: 0, failed: 0 };

    const failedItems =
      (await db.getAllAsync<SyncQueueItem>(
        'SELECT * FROM sync_queue WHERE status = ?',
        ['failed']
      )) ?? [];
    if (!failedItems.length) {
      return result;
    }

    for (const item of failedItems) {
      if (item.retry_count >= maxRetries) {
        result.failed++;
        continue;
      }

      result.retried++;

      try {
        const response = await this.makeApiRequest('/api/sync/push', {
          method: 'POST',
          body: JSON.stringify({
            changes: [this.mapQueueItemToSyncChange(item)],
          }),
        });

        const [itemResult] = (response.results?.itemResults ??
          []) as PushItemResult[];
        const responseError =
          typeof response.error === 'string' ? response.error : undefined;
        if (!itemResult) {
          await this.updateSyncQueueStatus(
            item.id,
            'failed',
            responseError ||
              `Retry response missing result for queue item ${item.id}`,
            true
          );
          result.failed++;
          continue;
        }

        if (response.success && itemResult?.status === 'success') {
          await this.handleSuccessfulPush(item, itemResult.record);
          result.success++;
          continue;
        }

        if (itemResult?.status === 'conflict') {
          const resolved = await this.handleConflictPush(
            item,
            itemResult.serverRecord
          );
          if (resolved) {
            result.success++;
          } else {
            result.failed++;
          }
          continue;
        }

        await this.updateSyncQueueStatus(
          item.id,
          'failed',
          itemResult?.error || responseError || 'Retry failed',
          true
        );
        result.failed++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown retry error';
        await this.updateSyncQueueStatus(
          item.id,
          'failed',
          message,
          true
        );
        result.failed++;
      }
    }

    emitSyncEvent();
    return result;
  }
}

export const syncEngine = SyncEngine.getInstance();
