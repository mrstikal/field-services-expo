import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// 1. Define mocks first
vi.mock('@/lib/sync/sync-engine', () => {
  const mockEngine = {
    beginSync: vi.fn(() => true),
    endSync: vi.fn(),
    initialize: vi.fn(),
    fullSync: vi.fn(),
    pullSync: vi.fn(),
    pushSync: vi.fn(),
    getStatus: vi.fn(() =>
      Promise.resolve({
        lastSync: null,
        pendingItems: 0,
        failedItems: 0,
        latestFailedError: null,
      })
    ),
    cleanupSyncQueue: vi.fn(),
    retryFailedSyncItems: vi.fn(),
  };
  return {
    SyncAuthUnavailableError: class SyncAuthUnavailableError extends Error {
      constructor() {
        super('No auth token available');
        this.name = 'SyncAuthUnavailableError';
      }
    },
    SyncNetworkUnavailableError: class SyncNetworkUnavailableError extends Error {
      constructor(apiUrl: string) {
        super(`Sync backend is unreachable at ${apiUrl}`);
        this.name = 'SyncNetworkUnavailableError';
      }
    },
    SyncEngine: {
      getInstance: vi.fn(() => mockEngine),
    },
  };
});

vi.mock('@/lib/hooks/use-network-status', () => ({
  useNetworkStatus: vi.fn(() => ({ status: 'online' })),
  useIsOnline: vi.fn(() => true),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', email: 'test@example.com' } })),
}));

vi.mock('@/lib/sync/sync-events', () => ({
  subscribeToSyncEvents: vi.fn(() => () => undefined),
}));

// 2. Hook imports
import { useOfflineSync } from '@lib/hooks/use-offline-sync';
import { SyncAuthUnavailableError, SyncEngine } from '@lib/sync/sync-engine';
import { useNetworkStatus } from '@lib/hooks/use-network-status';
import { useAuth } from '@lib/auth-context';

interface MockSyncEngine {
  beginSync: Mock;
  endSync: Mock;
  initialize: Mock;
  fullSync: Mock;
  pullSync: Mock;
  pushSync: Mock;
  getStatus: Mock;
  cleanupSyncQueue: Mock;
  retryFailedSyncItems: Mock;
}

describe('useOfflineSync', () => {
  const getMockSyncEngine = () =>
    SyncEngine.getInstance() as unknown as MockSyncEngine;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockSyncEngine = getMockSyncEngine();
    mockSyncEngine.beginSync.mockReturnValue(true);
    mockSyncEngine.initialize.mockResolvedValue(undefined);
    mockSyncEngine.getStatus.mockResolvedValue({
      lastSync: null,
      pendingItems: 0,
      failedItems: 0,
      latestFailedError: null,
    });

    (useNetworkStatus as Mock).mockReturnValue({ status: 'online' });
    (useAuth as Mock).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return sync state and actions', async () => {
    const { result } = renderHook(() => useOfflineSync());

    expect(result.current.syncState).toBeDefined();
    expect(result.current.isSyncing).toBeDefined();
    expect(result.current.sync).toBeDefined();
  });

  describe('performFullSync', () => {
    it('should perform full sync when user is logged in', async () => {
      const mockSyncEngine = getMockSyncEngine();
      const mockSyncResult = {
        pulled: { tasks: 1, reports: 1, locations: 0 },
        pushed: { success: 1, failed: 0, errors: [] },
      };

      mockSyncEngine.fullSync.mockResolvedValue(mockSyncResult);

      const { result } = renderHook(() => useOfflineSync());

      await result.current.sync();

      expect(mockSyncEngine.beginSync).toHaveBeenCalled();
      expect(mockSyncEngine.fullSync).toHaveBeenCalled();
      expect(mockSyncEngine.endSync).toHaveBeenCalled();
    });

    it('should not sync when user is not logged in', async () => {
      (useAuth as Mock).mockReturnValue({ user: null });
      const mockSyncEngine = getMockSyncEngine();

      const { result } = renderHook(() => useOfflineSync());

      await result.current.sync();

      expect(mockSyncEngine.beginSync).not.toHaveBeenCalled();
    });

    it('should handle sync timeout and update syncState correctly', async () => {
      vi.useFakeTimers();
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.fullSync.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useOfflineSync());
      try {
        const syncPromise = result.current.sync();

        await act(async () => {
          vi.advanceTimersByTime(30_001);
          await Promise.resolve();
        });

        await syncPromise;

        expect(result.current.isSyncing).toBe(false);
        expect(result.current.syncState.error).toContain('Sync timeout');
        expect(result.current.sync).toBeDefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle sync failure', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.fullSync.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOfflineSync());

      await act(async () => {
        await result.current.sync();
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false);
        expect(result.current.syncState.error).toContain('Network error');
      });
    });

    it('should ignore missing auth token without setting sync error', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.fullSync.mockRejectedValue(new SyncAuthUnavailableError());

      const { result } = renderHook(() => useOfflineSync());

      await act(async () => {
        await result.current.sync();
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false);
        expect(result.current.syncState.error ?? null).toBeNull();
      });
    });
  });

  describe('pull', () => {
    it('should perform pull sync', async () => {
      const mockSyncEngine = getMockSyncEngine();
      const mockPullResult = { tasks: 1, reports: 1, locations: 0 };
      mockSyncEngine.pullSync.mockResolvedValue(mockPullResult);

      const { result } = renderHook(() => useOfflineSync());

      await result.current.pull();

      expect(mockSyncEngine.pullSync).toHaveBeenCalled();
    });

    it('should handle network errors by returning null instead of throwing', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.pullSync.mockRejectedValue(
        new Error('Network request failed')
      );

      const { result } = renderHook(() => useOfflineSync());

      let pullResult;
      await act(async () => {
        pullResult = await result.current.pull();
      });

      expect(pullResult).toBeNull();
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('push', () => {
    it('should perform push sync', async () => {
      const mockSyncEngine = getMockSyncEngine();
      const mockPushResult = { success: 1, failed: 0, errors: [] };
      mockSyncEngine.pushSync.mockResolvedValue(mockPushResult);

      const { result } = renderHook(() => useOfflineSync());

      await result.current.push();

      expect(mockSyncEngine.pushSync).toHaveBeenCalled();
    });

    it('should handle network errors by returning null instead of throwing', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.pushSync.mockRejectedValue(
        new Error('Network request failed')
      );

      const { result } = renderHook(() => useOfflineSync());

      let pushResult;
      await act(async () => {
        pushResult = await result.current.push();
      });

      expect(pushResult).toBeNull();
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    it('should get sync status', async () => {
      const mockSyncEngine = getMockSyncEngine();
      const mockStatus = {
        lastSync: '2025-01-01T00:00:00.000Z',
        pendingItems: 5,
        failedItems: 0,
        latestFailedError: null,
      };
      mockSyncEngine.getStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useOfflineSync());

      await result.current.getSyncStatus();

      expect(mockSyncEngine.getStatus).toHaveBeenCalled();
    });
  });

  describe('cleanupSyncQueue', () => {
    it('should cleanup old sync queue items', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.cleanupSyncQueue.mockResolvedValue({ totalRemoved: 3 });

      const { result } = renderHook(() => useOfflineSync());

      await result.current.cleanupSyncQueue(7);

      expect(mockSyncEngine.cleanupSyncQueue).toHaveBeenCalledWith(7);
    });
  });

  describe('retryFailedSyncItems', () => {
    it('should retry failed sync items', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.retryFailedSyncItems.mockResolvedValue({ retried: 2 });

      const { result } = renderHook(() => useOfflineSync());

      await result.current.retryFailedSyncItems(3);

      expect(mockSyncEngine.retryFailedSyncItems).toHaveBeenCalledWith(3);
    });
  });
});
