import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { SyncEngine } from '../sync-engine';
import type { Task } from '@shared/index';
import type { Report } from '@shared/index';

// Mock dependencies
vi.mock('../../db/local-database', () => ({
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  resetDatabase: vi.fn(),
}));

vi.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../../db/task-repository', () => ({
  taskRepository: {
    getLastSyncTimestamp: vi.fn(),
    setLastSyncTimestamp: vi.fn(),
    upsertFromServer: vi.fn(),
  },
}));

vi.mock('../../db/report-repository', () => ({
  reportRepository: {
    upsertFromServer: vi.fn(),
  },
}));

// Import repositories after vi.mock is applied
import { taskRepository } from '../../db/task-repository';
import { reportRepository } from '../../db/report-repository';
import { getDatabase } from '../../db/local-database';
import { supabase } from '../../supabase';

interface MockDb {
  runAsync: Mock;
  getAllAsync: Mock;
  getFirstAsync: Mock;
}

describe('SyncEngine', () => {
  let mockDb: MockDb;
  let engine: SyncEngine;

  beforeEach(() => {
    mockDb = {
      runAsync: vi.fn(),
      getAllAsync: vi.fn(),
      getFirstAsync: vi.fn(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'test-user', email: 'test@example.com' },
        },
      },
      error: null,
    });

    vi.mocked(taskRepository.getLastSyncTimestamp).mockResolvedValue(null);
    vi.mocked(taskRepository.setLastSyncTimestamp).mockResolvedValue(undefined);

    vi.mocked(taskRepository.upsertFromServer).mockResolvedValue({} as Task);
    vi.mocked(reportRepository.upsertFromServer).mockResolvedValue({} as Report);

    engine = SyncEngine.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset singleton by resetting modules
    vi.resetModules();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SyncEngine.getInstance();
      const instance2 = SyncEngine.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('beginSync/endSync', () => {
    it('should begin sync when not in progress', () => {
      expect(engine.isSyncInProgress()).toBe(false);
      expect(engine.beginSync()).toBe(true);
      expect(engine.isSyncInProgress()).toBe(true);
    });

    it('should not begin sync when already in progress', () => {
      engine.beginSync();
      expect(engine.beginSync()).toBe(false);
      engine.endSync();
    });
  });

  describe('initialize', () => {
    it('should initialize with last sync timestamp', async () => {
      vi.mocked(taskRepository.getLastSyncTimestamp).mockResolvedValue('2025-01-01T00:00:00.000Z');

      await engine.initialize();

      expect(taskRepository.getLastSyncTimestamp).toHaveBeenCalled();
    });
  });

  describe('pullSync', () => {
    it('should pull changes from server', async () => {
      const mockResponse = {
        success: true,
        data: {
          tasks: [
            {
              id: 'task-1',
              title: 'Task 1',
              description: 'Desc 1',
              address: 'Addr 1',
              latitude: 48.1,
              longitude: 17.1,
              status: 'assigned' as const,
              priority: 'medium' as const,
              category: 'repair' as const,
              due_date: '2025-01-01',
              customer_name: 'Customer 1',
              customer_phone: '111',
              estimated_time: 1,
              technician_id: 'tech1',
              created_at: '2025-01-01T10:00:00.000Z',
              updated_at: '2025-01-01T10:00:00.000Z',
              version: 1,
              synced: 0,
            },
          ],
          reports: [
            {
              id: 'report-1',
              task_id: 'task-1',
              status: 'draft' as const,
              photos: [],
              form_data: {},
              signature: null,
              created_at: '2025-01-01T10:00:00.000Z',
              updated_at: '2025-01-01T10:00:00.000Z',
              version: 1,
              synced: 0,
            },
          ],
          locations: [],
          serverTimestamp: '2025-01-01T12:00:00.000Z',
        },
      };

      vi.mocked(mockDb!.getFirstAsync).mockResolvedValue({ count: 0 });
      vi.mocked(mockDb!.runAsync).mockResolvedValue(undefined);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      ) as unknown as typeof fetch;

      const result = await engine.pullSync();

      expect(result.tasks).toBe(1);
      expect(result.reports).toBe(1);
      expect(result.locations).toBe(0);

      expect(taskRepository.upsertFromServer).toHaveBeenCalled();
      expect(reportRepository.upsertFromServer).toHaveBeenCalled();
      expect(taskRepository.setLastSyncTimestamp).toHaveBeenCalledWith('2025-01-01T12:00:00.000Z');
    });

    it('should throw error if pull API fails', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      ) as unknown as typeof fetch;

      await expect(engine.pullSync()).rejects.toThrow('API request failed: 500 Internal Server Error');
    });

    it('should throw error if response success is false', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: false }),
        })
      ) as unknown as typeof fetch;

      await expect(engine.pullSync()).rejects.toThrow('Pull sync API call failed');
    });
  });

  describe('pushSync', () => {
    it('should push pending changes to server', async () => {
      const mockQueueItems = [
        {
          id: 'queue-1',
          type: 'task' as const,
          action: 'create' as const,
          data: JSON.stringify({ id: 'task-1', title: 'Task 1' }),
          version: 1,
          status: 'pending' as const,
          retry_count: 0,
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
        },
      ];

      const mockResponse = {
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'success',
            },
          ],
        },
      };

      vi.mocked(mockDb!.getAllAsync).mockResolvedValue(mockQueueItems);
      vi.mocked(mockDb!.runAsync).mockResolvedValue(undefined);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      ) as unknown as typeof fetch;

      const result = await engine.pushSync();

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);

      expect(mockDb!.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining(['synced', expect.any(String), 'queue-1'])
      );
    });

    it('should return empty result if no pending items', async () => {
      vi.mocked(mockDb!.getAllAsync).mockResolvedValue([]);

      const result = await engine.pushSync();

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle failed items', async () => {
      const mockQueueItems = [
        {
          id: 'queue-1',
          type: 'task' as const,
          action: 'create' as const,
          data: JSON.stringify({ id: 'task-1', title: 'Task 1' }),
          version: 1,
          status: 'pending' as const,
          retry_count: 0,
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
        },
      ];

      const mockResponse = {
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'failed',
              error: 'Network error',
            },
          ],
        },
      };

      vi.mocked(mockDb!.getAllAsync).mockResolvedValue(mockQueueItems);
      vi.mocked(mockDb!.runAsync).mockResolvedValue(undefined);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      ) as unknown as typeof fetch;

      const result = await engine.pushSync();

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Network error');
    });
  });

  describe('fullSync', () => {
    it('should perform pull and push sync', async () => {
      vi.mocked(mockDb!.getFirstAsync).mockResolvedValue({ count: 0 });
      vi.mocked(mockDb!.runAsync).mockResolvedValue(undefined);

      global.fetch = vi.fn((url) => {
        if (url.includes('/api/sync/pull')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  tasks: [],
                  reports: [],
                  locations: [],
                  serverTimestamp: '2025-01-01T12:00:00.000Z',
                },
              }),
          });
        }
        if (url.includes('/api/sync/push')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                results: { itemResults: [] },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      }) as unknown as typeof fetch;

      const result = await engine.fullSync();

      expect(result.pulled.tasks).toBe(0);
      expect(result.pulled.reports).toBe(0);
      expect(result.pulled.locations).toBe(0);
      expect(result.pushed.success).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return sync status', async () => {
      vi.mocked(taskRepository.getLastSyncTimestamp).mockResolvedValue('2025-01-01T00:00:00.000Z');
      vi.mocked(mockDb!.getFirstAsync).mockResolvedValue({ count: 5 });

      const result = await engine.getStatus();

      expect(result.lastSync).toBe('2025-01-01T00:00:00.000Z');
      expect(result.pendingItems).toBe(5);
    });
  });

  describe('cleanupSyncQueue', () => {
    it('should remove old synced and failed items', async () => {
      vi.mocked(mockDb!.getFirstAsync).mockResolvedValue({ count: 2 });
      vi.mocked(mockDb!.runAsync).mockResolvedValue(undefined);

      const result = await engine.cleanupSyncQueue(7);

      expect(result.syncedRemoved).toBe(2);
      expect(result.failedRemoved).toBe(2);
      expect(result.totalRemoved).toBe(4);

      expect(mockDb!.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sync_queue WHERE status = ?'),
        expect.any(Array)
      );
    });
  });

  describe('retryFailedSyncItems', () => {
    it('should retry failed items', async () => {
      const mockFailedItems = [
        {
          id: 'queue-1',
          type: 'task' as const,
          action: 'create' as const,
          data: JSON.stringify({ id: 'task-1', title: 'Task 1' }),
          version: 1,
          status: 'failed' as const,
          error: 'Network error',
          retry_count: 0,
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
        },
      ];

      const mockResponse = {
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'success',
            },
          ],
        },
      };

      vi.mocked(mockDb!.getAllAsync).mockResolvedValue(mockFailedItems);
      vi.mocked(mockDb!.runAsync).mockResolvedValue(undefined);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      ) as unknown as typeof fetch;

      const result = await engine.retryFailedSyncItems(3);

      expect(result.retried).toBe(1);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should not retry items that exceeded max retries', async () => {
      const mockFailedItems = [
        {
          id: 'queue-1',
          type: 'task' as const,
          action: 'create' as const,
          data: JSON.stringify({ id: 'task-1', title: 'Task 1' }),
          version: 1,
          status: 'failed' as const,
          error: 'Network error',
          retry_count: 3,
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
        },
      ];

      vi.mocked(mockDb!.getAllAsync).mockResolvedValue(mockFailedItems);

      const result = await engine.retryFailedSyncItems(3);

      expect(result.retried).toBe(0);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
    });
  });
});
