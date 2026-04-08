import { supabase } from '@/lib/supabase';
import { taskRepository } from '@/lib/db/task-repository';
import { reportRepository } from '@/lib/db/report-repository';
import { Task, Report } from '@shared/index';
import { getDatabase } from '@/lib/db/local-database';

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

// Interface for sync queue items
interface SyncQueueItem {
  id: string;
  type: 'task' | 'report' | 'location';
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  version: number;
  status: 'pending' | 'synced' | 'failed';
  error?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

let syncEngineInstance: SyncEngine | null = null;

/**
 * Sync Engine - Handles offline-first synchronization
 * Implements pull and push sync with conflict resolution using API endpoints
 */
export class SyncEngine {
  private lastSyncTimestamp: string | null = null;
  private syncInProgress: boolean = false;

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

  /**
   * Get singleton instance of SyncEngine
   */
  static getInstance(): SyncEngine {
    if (!syncEngineInstance) {
      syncEngineInstance = new SyncEngine();
    }
    return syncEngineInstance;
  }

  /**
   * Initialize sync engine
   */
  async initialize(): Promise<void> {
    this.lastSyncTimestamp = await taskRepository.getLastSyncTimestamp();
  }

  /**
   * Get user's auth token for API authentication
   */
  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  /**
   * Make authenticated API request
   */
  private async makeApiRequest(url: string, options: RequestInit = {}) {
    const token = await this.getAuthToken();
    
    if (!token) {
      throw new Error('No auth token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const apiUrl = `${apiBaseUrl}${url}`;

    let response: Response;

    try {
      response = await fetch(apiUrl, {
        ...options,
        headers,
      });
    } catch (error) {
      throw new SyncNetworkUnavailableError(apiUrl, error);
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ==================== PULL SYNC ====================

  /**
   * Pull changes from server using API endpoint
   * Fetches all changes since last sync timestamp
   */
  async pullSync(): Promise<{
    tasks: number;
    reports: number;
    locations: number;
  }> {
    const result = {
      tasks: 0,
      reports: 0,
      locations: 0,
    };

    // Get last sync timestamp
    const lastSync = this.lastSyncTimestamp || new Date(0).toISOString();

    // Call pull API endpoint
    const response = await this.makeApiRequest('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ lastSyncTimestamp: lastSync }),
    });

    if (!response.success) {
      throw new Error('Pull sync API call failed');
    }

    const { data } = response;

    // Process tasks
    if (data.tasks && data.tasks.length > 0) {
      for (const task of data.tasks) {
        await this.upsertTask(task);
      }
      result.tasks = data.tasks.length;
    }

    // Process reports
    if (data.reports && data.reports.length > 0) {
      for (const report of data.reports) {
        await this.upsertReport(report);
      }
      result.reports = data.reports.length;
    }

    // Process locations
    if (data.locations && data.locations.length > 0) {
      for (const location of data.locations) {
        await this.upsertLocation(location);
      }
      result.locations = data.locations.length;
    }

    // Update last sync timestamp with server timestamp
    const serverTimestamp = data.serverTimestamp || new Date().toISOString();
    await taskRepository.setLastSyncTimestamp(serverTimestamp);
    this.lastSyncTimestamp = serverTimestamp;

    return result;
  }

    /**
      * Upsert task with conflict resolution
      */
     private async upsertTask(serverTask: Record<string, unknown>): Promise<void> {
      // Use upsertFromServer to avoid adding to sync queue
      await taskRepository.upsertFromServer(serverTask as Task);
    }

   /**
    * Upsert report with conflict resolution
    */
   private async upsertReport(serverReport: Record<string, unknown>): Promise<void> {
     // Use upsertFromServer to avoid adding to sync queue
     await reportRepository.upsertFromServer(serverReport as Report);
   }

    /**
     * Upsert location (stub implementation for now)
     */
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      private async upsertLocation(location: Record<string, unknown>): Promise<void> {
        // Currently we don't store locations locally, so just ignore
        // Future enhancement: implement local storage for locations if needed
      }

  // ==================== PUSH SYNC ====================

  /**
   * Push local changes to server using API endpoint
   * Processes all pending items in local sync_queue
   */
  async pushSync(): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Get all pending sync queue items from local database
    const db = getDatabase();
    const queueItems = await db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC`,
      ['pending']
    );

    if (!queueItems || queueItems.length === 0) {
      return result;
    }

    // Prepare changes for API
    const changes = queueItems.map(item => ({
      id: item.id,
      type: item.type,
      action: item.action,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data,
      version: item.version
    }));

    const queueItemsById = new Map(queueItems.map((item) => [item.id, item]));

    // Send changes to push API endpoint
    const response = await this.makeApiRequest('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes }),
    });

    if (!response.success) {
      throw new Error('Push sync API call failed');
    }

     // Deterministic per-item reconciliation by queue item id.
     const itemResults = response.results?.itemResults;
     if (Array.isArray(itemResults) && itemResults.length > 0) {
       const handledIds = new Set<string>();

       for (const itemResult of itemResults) {
         if (!itemResult?.id || handledIds.has(itemResult.id)) continue;
         handledIds.add(itemResult.id);

         if (!queueItemsById.has(itemResult.id)) continue;

         if (itemResult.status === 'success') {
           await this.updateSyncQueueStatus(itemResult.id, 'synced');
           result.success++;
           continue;
         }

         const message = itemResult.error || `Sync failed for queue item ${itemResult.id}`;
         await this.updateSyncQueueStatus(itemResult.id, 'failed', message);
         result.failed++;
         result.errors.push(message);
       }

       // If server omitted a queue item result, keep item for retry and report it.
       for (const item of queueItems) {
         if (handledIds.has(item.id)) continue;
         const missingResultError = `Missing result for queue item ${item.id}`;
         await this.updateSyncQueueStatus(item.id, 'failed', missingResultError);
         result.failed++;
         result.errors.push(missingResultError);
       }
     } else {
       throw new Error('Push sync API returned no itemResults');
     }

    return result;
  }

  /**
   * Update status of a sync queue item
   */
  private async updateSyncQueueStatus(id: string, status: 'pending' | 'synced' | 'failed', error?: string): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    if (error) {
      await db.runAsync(
        `UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
        [status, error, now, id]
      );
    } else {
      await db.runAsync(
        `UPDATE sync_queue SET status = ?, error = NULL, updated_at = ? WHERE id = ?`,
        [status, now, id]
      );
    }
  }
  
  /**
   * Update status and retry count of a sync queue item
   */
  private async updateSyncQueueStatusWithRetry(id: string, status: 'pending' | 'synced' | 'failed', error?: string, incrementRetry: boolean = false): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    if (incrementRetry) {
      await db.runAsync(
        `UPDATE sync_queue SET status = ?, error = ?, retry_count = retry_count + 1, updated_at = ? WHERE id = ?`,
        [status, error || null, now, id]
      );
    } else {
      if (error) {
        await db.runAsync(
          `UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
          [status, error, now, id]
        );
      } else {
        await db.runAsync(
          `UPDATE sync_queue SET status = ?, error = NULL, updated_at = ? WHERE id = ?`,
          [status, now, id]
        );
      }
    }
  }

  /**
   * Push task update to server (for conflict resolution)
   */
  private async pushTaskUpdate(task: Task): Promise<void> {
    // Add the task to sync queue for later pushing
    const db = getDatabase();
    const now = new Date().toISOString();
    
    await db.runAsync(
      `INSERT INTO sync_queue (id, type, action, data, version, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        crypto.randomUUID(),
        'task',
        'update',
        JSON.stringify(task),
        task.version,
        now,
        now,
      ]
    );
  }

  /**
   * Push report update to server (for conflict resolution)
   */
  private async pushReportUpdate(report: Report): Promise<void> {
    // Add the report to sync queue for later pushing
    const db = getDatabase();
    const now = new Date().toISOString();
    
    await db.runAsync(
      `INSERT INTO sync_queue (id, type, action, data, version, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        crypto.randomUUID(),
        'report',
        'update',
        JSON.stringify(report),
        report.version,
        now,
        now,
      ]
    );
  }

  // ==================== FULL SYNC ====================

  /**
   * Full sync - pull then push
   */
  async fullSync(): Promise<{
    pulled: { tasks: number; reports: number; locations: number };
    pushed: { success: number; failed: number; errors: string[] };
  }> {
    const pulled = await this.pullSync();
    const pushed = await this.pushSync();

    return { pulled, pushed };
  }

  // ==================== STATUS ====================

  /**
   * Get sync status
   */
  async getStatus(): Promise<{
    lastSync: string | null;
    pendingItems: number;
  }> {
    const lastSync = await taskRepository.getLastSyncTimestamp();
    const db = getDatabase();
    
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = ?`,
      ['pending']
    );

    return { lastSync, pendingItems: result?.count || 0 };
  }

  /**
   * Clean up old synced and failed items from sync queue
   * Removes items older than specified days (defaults to 7 days)
   */
  async cleanupSyncQueue(olderThanDays: number = 7): Promise<{
    syncedRemoved: number;
    failedRemoved: number;
    totalRemoved: number;
  }> {
    const db = getDatabase();
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    
    // Count items to be removed
    const syncedCountResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['synced', cutoffDate]
    );
    
    const failedCountResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['failed', cutoffDate]
    );
    
    const syncedCount = syncedCountResult?.count || 0;
    const failedCount = failedCountResult?.count || 0;
    
    // Remove old synced items
    await db.runAsync(
      `DELETE FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['synced', cutoffDate]
    );
    
    // Remove old failed items
    await db.runAsync(
      `DELETE FROM sync_queue WHERE status = ? AND updated_at < ?`,
      ['failed', cutoffDate]
    );
    
    return {
      syncedRemoved: syncedCount,
      failedRemoved: failedCount,
      totalRemoved: syncedCount + failedCount
    };
  }

  /**
   * Retry failed sync items
   * Attempts to sync items that previously failed
   */
  async retryFailedSyncItems(maxRetries: number = 3): Promise<{
    retried: number;
    success: number;
    failed: number;
  }> {
    const db = getDatabase();
    const result = {
      retried: 0,
      success: 0,
      failed: 0,
    };

    // Get failed items that haven't exceeded max retries
    const failedItems = await db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status = ?`,
      ['failed']
    );

    if (!failedItems || failedItems.length === 0) {
      return result;
    }

    for (const item of failedItems) {
      // Skip if already attempted too many times
      if (item.retry_count >= maxRetries) {
        result.failed++;
        continue;
      }

      result.retried++;

      try {
        // Try to sync the individual item
        const changes = [{
          id: item.id,
          type: item.type,
          action: item.action,
          data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data,
          version: item.version
        }];

        const response = await this.makeApiRequest('/api/sync/push', {
          method: 'POST',
          body: JSON.stringify({ changes }),
        });

        if (response.success) {
          // Success - update status to synced
          await this.updateSyncQueueStatus(item.id, 'synced');
          result.success++;
        } else {
          // Failed again - increment retry counter and update status
          const currentAttempt = item.retry_count + 1;
          const newError = `Retry attempt ${currentAttempt}: Sync failed`;
          await this.updateSyncQueueStatusWithRetry(item.id, 'failed', newError, true);
          result.failed++;
        }
      } catch (retryError: unknown) {
        // Failed again - increment retry counter and update status
        const currentAttempt = item.retry_count + 1;
        const errorMessage = retryError instanceof Error 
          ? `Retry attempt ${currentAttempt}: ${retryError.message}` 
          : `Retry attempt ${currentAttempt}: Unknown error`;
        
        await this.updateSyncQueueStatusWithRetry(item.id, 'failed', errorMessage, true);
        result.failed++;
      }
    }

    return result;
  }

  // Removed unused extractRetryAttempt method since we now use retry_count column
}

// Singleton instance
export const syncEngine = new SyncEngine();