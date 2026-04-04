import { useState, useEffect, useCallback } from 'react';
import { SyncEngine } from '@/lib/sync/sync-engine';
import { useNetworkStatus, useIsOnline } from '@/lib/hooks/use-network-status';
import { useAuth } from '@/lib/auth-context';

interface SyncState {
  isSyncing: boolean;
  lastSync: string | null;
  pendingItems: number;
  lastPull: {
    tasks: number;
    reports: number;
    locations: number;
  } | null;
  lastPush: {
    success: number;
    failed: number;
    errors: string[];
  } | null;
}

// Global sync engine instance
const globalSyncEngine = SyncEngine.getInstance();

/**
 * Hook for managing offline-first synchronization
 * Automatically syncs when going online, provides manual sync trigger
 */
export function useOfflineSync() {
  const { user } = useAuth();
  const { status } = useNetworkStatus();
  const isOnline = useIsOnline();

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
    pendingItems: 0,
    lastPull: null,
    lastPush: null,
  });

  // Use global lock from sync engine instead of local ref
  const isSyncInProgress = globalSyncEngine.isSyncInProgress();

  // Initialize sync engine when user logs in
  useEffect(() => {
    if (user) {
      globalSyncEngine.initialize();
    }
  }, [user]);

  // Auto-sync when going online
  useEffect(() => {
    if (isOnline && !isSyncInProgress && user) {
      // Debounce to avoid multiple rapid syncs
      const timeoutId = setTimeout(() => {
        performFullSync();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, user, isSyncInProgress]);

  // Fetch sync status periodically
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(async () => {
      const status = await globalSyncEngine.getStatus();
      setSyncState((prev) => ({
        ...prev,
        lastSync: status.lastSync,
        pendingItems: status.pendingItems,
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(intervalId);
  }, [user]);

  // Perform full sync (pull + push)
  const performFullSync = useCallback(async () => {
    if (!user) return;
    if (!globalSyncEngine.beginSync()) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await globalSyncEngine.fullSync();

      setSyncState((prev) => ({
        ...prev,
        lastPull: result.pulled,
        lastPush: result.pushed,
        isSyncing: false,
      }));
    } catch (error) {
      console.error('Full sync failed:', error);
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    } finally {
      globalSyncEngine.endSync();
    }
  }, [user]);

  // Manual sync trigger
  const sync = useCallback(async () => {
    if (!user) return;
    return performFullSync();
  }, [user, performFullSync]);

  // Pull only
  const pull = useCallback(async () => {
    if (!user) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await globalSyncEngine.pullSync();

      setSyncState((prev) => ({
        ...prev,
        lastPull: result,
        isSyncing: false,
      }));

      return result;
    } catch (error) {
      console.error('Pull sync failed:', error);
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
      throw error;
    }
  }, [user]);

  // Push only
  const push = useCallback(async () => {
    if (!user) return;

    setSyncState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await globalSyncEngine.pushSync();

      setSyncState((prev) => ({
        ...prev,
        lastPush: result,
        isSyncing: false,
      }));

      return result;
    } catch (error) {
      console.error('Push sync failed:', error);
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
      throw error;
    }
  }, [user]);

  // Get sync status
  const getSyncStatus = useCallback(async () => {
    if (!user) return null;
    return globalSyncEngine.getStatus();
  }, [user]);

  // Cleanup old sync queue items
  const cleanupSyncQueue = useCallback(async (olderThanDays?: number) => {
    if (!user) return null;
    return globalSyncEngine.cleanupSyncQueue(olderThanDays);
  }, [user]);

  // Retry failed sync items
  const retryFailedSyncItems = useCallback(async (maxRetries?: number) => {
    if (!user) return null;
    return globalSyncEngine.retryFailedSyncItems(maxRetries);
  }, [user]);

  return {
    // State
    syncState,
    isSyncing: syncState.isSyncing,
    lastSync: syncState.lastSync,
    pendingItems: syncState.pendingItems,
    lastPull: syncState.lastPull,
    lastPush: syncState.lastPush,

    // Actions
    sync,
    pull,
    push,
    getSyncStatus,
    cleanupSyncQueue,
    retryFailedSyncItems,

    // Network status
    isOnline,
    networkStatus: status,
  };
}

/**
 * Hook that triggers callback when sync completes successfully
 */
export function useOnSyncComplete(callback: (result: any) => void) {
  const { syncState } = useOfflineSync();

  useEffect(() => {
    if (syncState.lastPull && syncState.lastPush && !syncState.isSyncing) {
      callback({ pull: syncState.lastPull, push: syncState.lastPush });
    }
  }, [syncState.lastPull, syncState.lastPush, syncState.isSyncing, callback]);
}