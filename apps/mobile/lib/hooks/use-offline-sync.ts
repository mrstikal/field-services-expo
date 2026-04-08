import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEngine, SyncNetworkUnavailableError } from '@/lib/sync/sync-engine';
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

function logSyncFailure(scope: 'full' | 'pull' | 'push', error: unknown) {
  if (error instanceof SyncNetworkUnavailableError) {
    console.warn(`[sync:${scope}] Backend unavailable: ${error.apiUrl}`);
    return;
  }

  console.error(`${scope[0].toUpperCase()}${scope.slice(1)} sync failed:`, error);
}

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


   // Ref to track the previous online state and last sync error time
   const prevIsOnlineRef = useRef<boolean>(false);
   const lastSyncErrorAtRef = useRef<number>(0);
   // Minimum ms to wait before retrying after a network error
   const SYNC_ERROR_COOLDOWN_MS = 60_000;

   // Perform full sync (pull + push)
   const performFullSync = useCallback(async () => {
     if (!user) return;
     if (!globalSyncEngine.beginSync()) return;

     setSyncState((prev) => ({ ...prev, isSyncing: true }));

     try {
       const syncPromise = globalSyncEngine.fullSync();
       const timeoutPromise = new Promise((_, reject) =>
         setTimeout(() => reject(new Error('Sync timeout')), 30000)
       );
       
        const result = await Promise.race([syncPromise, timeoutPromise]);

        setSyncState((prev) => ({
          ...prev,
          lastPull: (result as Record<string, unknown>).pulled as typeof prev.lastPull,
          lastPush: (result as Record<string, unknown>).pushed as typeof prev.lastPush,
          isSyncing: false,
        }));
     } catch (error) {
       // Record error time for cooldown so we don't hammer a down server
       lastSyncErrorAtRef.current = Date.now();
       logSyncFailure('full', error);
       setSyncState((prev) => ({ ...prev, isSyncing: false }));
     } finally {
       globalSyncEngine.endSync();
     }
   }, [user]);

   // Initialize sync engine when user logs in
   useEffect(() => {
     if (user) {
       globalSyncEngine.initialize();
     }
   }, [user]);

   // Auto-sync ONLY when transitioning from offline → online (or on first mount when online).
   // Using a ref to track previous value avoids re-triggering after every sync completion,
   // which would cause an infinite retry loop when the server is unreachable.
   useEffect(() => {
     const wentOnline = isOnline && !prevIsOnlineRef.current;
     prevIsOnlineRef.current = isOnline;

     if (!wentOnline || !user) return;

     // Respect cooldown after a recent sync error to avoid hammering a down server
     const msSinceLastError = Date.now() - lastSyncErrorAtRef.current;
     const delay = msSinceLastError < SYNC_ERROR_COOLDOWN_MS
       ? SYNC_ERROR_COOLDOWN_MS - msSinceLastError + 1000
       : 1000;

     const timeoutId = setTimeout(() => {
       performFullSync();
     }, delay);

      return () => clearTimeout(timeoutId);
    }, [isOnline, user, performFullSync]);

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
      logSyncFailure('pull', error);
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
      logSyncFailure('push', error);
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
export function useOnSyncComplete(callback: (result: { pull: SyncState['lastPull']; push: SyncState['lastPush'] }) => void) {
  const { syncState } = useOfflineSync();

  useEffect(() => {
    if (syncState.lastPull && syncState.lastPush && !syncState.isSyncing) {
      callback({ pull: syncState.lastPull, push: syncState.lastPush });
    }
  }, [syncState.lastPull, syncState.lastPush, syncState.isSyncing, callback]);
}
