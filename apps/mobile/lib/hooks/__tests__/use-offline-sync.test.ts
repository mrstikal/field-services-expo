import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';

// 1. Definuj Mocky nejdříve
vi.mock('../../sync/sync-engine', () => {
  const mockEngine = {
    beginSync: vi.fn(() => true),
    endSync: vi.fn(),
    initialize: vi.fn(),
    fullSync: vi.fn(),
    pullSync: vi.fn(),
    pushSync: vi.fn(),
    getStatus: vi.fn(() => Promise.resolve({ lastSync: null, pendingItems: 0 })),
    cleanupSyncQueue: vi.fn(),
    retryFailedSyncItems: vi.fn(),
  };
  return {
    SyncEngine: {
      getInstance: vi.fn(() => mockEngine),
    },
  };
});

vi.mock('../use-network-status', () => ({
  useNetworkStatus: vi.fn(() => ({ status: 'online' })),
  useIsOnline: vi.fn(() => true),
}));

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', email: 'test@example.com' } })),
}));

// 2. Importy hooků
import { useOfflineSync } from '../use-offline-sync';
import { SyncEngine } from '../../sync/sync-engine';
import { useNetworkStatus } from '../use-network-status';
import { useAuth } from '../../auth-context';

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
  const getMockSyncEngine = () => SyncEngine.getInstance() as unknown as MockSyncEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockSyncEngine = getMockSyncEngine();
    mockSyncEngine.beginSync.mockReturnValue(true);
    mockSyncEngine.getStatus.mockResolvedValue({ lastSync: null, pendingItems: 0 });
    
    (useNetworkStatus as Mock).mockReturnValue({ status: 'online' });
    (useAuth as Mock).mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
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

    it('should handle sync timeout', async () => {
      const mockSyncEngine = getMockSyncEngine();
      mockSyncEngine.fullSync.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      const { result } = renderHook(() => useOfflineSync());

      try {
          await result.current.sync();
      } catch {
        // Ignored in test
      }
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
  });

  describe('getSyncStatus', () => {
    it('should get sync status', async () => {
      const mockSyncEngine = getMockSyncEngine();
      const mockStatus = { lastSync: '2025-01-01T00:00:00.000Z', pendingItems: 5 };
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
