import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SyncAuthUnavailableError,
  SyncEngine,
  SyncNetworkUnavailableError,
} from '@/lib/sync/sync-engine';
import { subscribeToSyncEvents } from '@/lib/sync/sync-events';
import { useNetworkStatus, useIsOnline } from '@/lib/hooks/use-network-status';
import { useAuth } from '@/lib/auth-context';

export interface SyncState {
  isSyncing: boolean;
  lastSync: string | null;
  pendingItems: number;
  failedItems: number;
  latestFailedError: string | null;
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
  error?: string | null;
}

const globalSyncEngine = SyncEngine.getInstance();
let lastPeriodicPullAt = 0;

function logSyncFailure(scope: 'full' | 'pull' | 'push', error: unknown) {
  if (
    error instanceof SyncAuthUnavailableError ||
    (error instanceof Error &&
      (error.name === 'SyncAuthUnavailableError' ||
        error.message === 'No auth token available'))
  ) {
    console.warn(`[sync:${scope}] Auth token is not ready yet. Skipping sync.`);
    return;
  }

  if (
    error instanceof SyncNetworkUnavailableError ||
    (error instanceof Error &&
      (error.name === 'SyncNetworkUnavailableError' ||
        error.message.includes('Network request failed')))
  ) {
    const apiUrl =
      error instanceof SyncNetworkUnavailableError ? error.apiUrl : 'unknown';
    console.warn(
      `[sync:${scope}] Backend unavailable at ${apiUrl}. Skipping sync.`
    );
    return;
  }

  if (
    error instanceof TypeError &&
    error.message.includes('Network request failed')
  ) {
    console.warn(`[sync:${scope}] Network request failed during transition.`);
    return;
  }

  console.error(
    `${scope[0].toUpperCase()}${scope.slice(1)} sync failed:`,
    error
  );
}

export function useOfflineSync() {
  const { user } = useAuth();
  const { status } = useNetworkStatus();
  const isOnline = useIsOnline();

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
    pendingItems: 0,
    failedItems: 0,
    latestFailedError: null,
    lastPull: null,
    lastPush: null,
  });

  const prevIsOnlineRef = useRef(false);
  const lastSyncErrorAtRef = useRef(0);
  const lastPendingAutoSyncAtRef = useRef(0);
  const lastFailedAutoRetryAtRef = useRef(0);
  const SYNC_ERROR_COOLDOWN_MS = 60_000;
  const PENDING_AUTO_SYNC_COOLDOWN_MS = 10_000;
  const FAILED_AUTO_RETRY_COOLDOWN_MS = 20_000;

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    const currentStatus = await globalSyncEngine.getStatus();
    setSyncState(prev => ({
      ...prev,
      lastSync: currentStatus.lastSync,
      pendingItems: currentStatus.pendingItems,
      failedItems: currentStatus.failedItems,
      latestFailedError: currentStatus.latestFailedError,
    }));
  }, [user]);

  const performFullSync = useCallback(async () => {
    if (!user) return;
    if (!globalSyncEngine.beginSync()) return;

    setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const syncPromise = globalSyncEngine.fullSync();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sync timeout')), 30000)
      );
      const result = (await Promise.race([
        syncPromise,
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof globalSyncEngine.fullSync>>;

      setSyncState(prev => ({
        ...prev,
        lastPull: result.pulled,
        lastPush: result.pushed,
        isSyncing: false,
      }));
      await refreshStatus();
    } catch (err) {
      logSyncFailure('full', err);
      if (!(err instanceof SyncAuthUnavailableError)) {
        lastSyncErrorAtRef.current = Date.now();
      }
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error:
          err instanceof SyncAuthUnavailableError
            ? null
            : err instanceof Error
              ? err.message
              : 'Sync failed',
      }));
    } finally {
      globalSyncEngine.endSync();
    }
  }, [refreshStatus, user]);

  const performPullSync = useCallback(async () => {
    if (!user) return null;
    if (!globalSyncEngine.beginSync()) return null;

    setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await globalSyncEngine.pullSync();
      setSyncState(prev => ({
        ...prev,
        lastPull: result,
        isSyncing: false,
      }));
      await refreshStatus();
      return result;
    } catch (error) {
      logSyncFailure('pull', error);
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      if (
        error instanceof SyncAuthUnavailableError ||
        (error instanceof Error && error.name === 'SyncAuthUnavailableError') ||
        error instanceof SyncNetworkUnavailableError ||
        (error instanceof Error &&
          (error.name === 'SyncNetworkUnavailableError' ||
            error.message.includes('Network request failed')))
      ) {
        return null;
      }
      throw error;
    } finally {
      globalSyncEngine.endSync();
    }
  }, [refreshStatus, user]);

  useEffect(() => {
    if (!user) return;

    globalSyncEngine.initialize().then(refreshStatus);

    const unsubscribe = subscribeToSyncEvents(() => {
      void (async () => {
        await refreshStatus();

        if (!isOnline || globalSyncEngine.isSyncInProgress()) {
          return;
        }

        const status = await globalSyncEngine.getStatus();
        if (status.pendingItems > 0 || status.failedItems > 0) {
          await performFullSync();
        }
      })();
    });

    return unsubscribe;
  }, [isOnline, performFullSync, refreshStatus, user]);

  useEffect(() => {
    const wentOnline = isOnline && !prevIsOnlineRef.current;
    prevIsOnlineRef.current = isOnline;

    if (!wentOnline || !user) return;

    const msSinceLastError = Date.now() - lastSyncErrorAtRef.current;
    const delay =
      msSinceLastError < SYNC_ERROR_COOLDOWN_MS
        ? SYNC_ERROR_COOLDOWN_MS - msSinceLastError + 1000
        : 1000;

    const timeoutId = setTimeout(() => {
      performFullSync();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [isOnline, performFullSync, user]);

  useEffect(() => {
    if (!user || !isOnline || syncState.isSyncing || syncState.pendingItems <= 0) {
      return;
    }

    const now = Date.now();
    if (now - lastPendingAutoSyncAtRef.current < PENDING_AUTO_SYNC_COOLDOWN_MS) {
      return;
    }

    lastPendingAutoSyncAtRef.current = now;
    performFullSync();
  }, [
    isOnline,
    performFullSync,
    syncState.isSyncing,
    syncState.pendingItems,
    user,
  ]);

  useEffect(() => {
    if (!user || !isOnline || syncState.isSyncing || syncState.failedItems <= 0) {
      return;
    }

    const now = Date.now();
    if (now - lastFailedAutoRetryAtRef.current < FAILED_AUTO_RETRY_COOLDOWN_MS) {
      return;
    }

    lastFailedAutoRetryAtRef.current = now;
    void (async () => {
      await globalSyncEngine.retryFailedSyncItems(Number.POSITIVE_INFINITY);
      await refreshStatus();
      await performFullSync();
    })();
  }, [
    isOnline,
    performFullSync,
    refreshStatus,
    syncState.failedItems,
    syncState.isSyncing,
    user,
  ]);

  useEffect(() => {
    if (
      !user ||
      !isOnline ||
      syncState.isSyncing ||
      syncState.pendingItems > 0 ||
      syncState.failedItems > 0
    ) {
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastPeriodicPullAt < 15_000) {
        return;
      }

      lastPeriodicPullAt = now;
      void performPullSync();
    }, 15_000);

    return () => clearInterval(intervalId);
  }, [
    isOnline,
    performPullSync,
    syncState.failedItems,
    syncState.isSyncing,
    syncState.pendingItems,
    user,
  ]);

  const sync = useCallback(async () => {
    if (!user) return;
    return performFullSync();
  }, [performFullSync, user]);

  const pull = useCallback(async () => {
    return performPullSync();
  }, [performPullSync]);

  const push = useCallback(async () => {
    if (!user) return;

    setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));
    try {
      const result = await globalSyncEngine.pushSync();
      setSyncState(prev => ({ ...prev, isSyncing: false, lastPush: result }));
      await refreshStatus();
      return result;
    } catch (error) {
      logSyncFailure('push', error);
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      // Do not re-throw network errors to avoid crashing the app during transition
      if (
        error instanceof SyncAuthUnavailableError ||
        (error instanceof Error && error.name === 'SyncAuthUnavailableError') ||
        error instanceof SyncNetworkUnavailableError ||
        (error instanceof Error &&
          (error.name === 'SyncNetworkUnavailableError' ||
            error.message.includes('Network request failed')))
      ) {
        return null;
      }
      throw error;
    }
  }, [refreshStatus, user]);

  const getSyncStatus = useCallback(async () => {
    if (!user) return null;
    return globalSyncEngine.getStatus();
  }, [user]);

  const cleanupSyncQueue = useCallback(
    async (olderThanDays?: number) => {
      if (!user) return null;
      const cleanupResult =
        await globalSyncEngine.cleanupSyncQueue(olderThanDays);
      await refreshStatus();
      return cleanupResult;
    },
    [refreshStatus, user]
  );

  const retryFailedSyncItems = useCallback(
    async (maxRetries?: number) => {
      if (!user) return null;
      const retryResult =
        await globalSyncEngine.retryFailedSyncItems(maxRetries);
      await refreshStatus();
      return retryResult;
    },
    [refreshStatus, user]
  );

  return {
    syncState,
    isSyncing: syncState.isSyncing,
    lastSync: syncState.lastSync,
    pendingItems: syncState.pendingItems,
    failedItems: syncState.failedItems,
    latestFailedError: syncState.latestFailedError,
    lastPull: syncState.lastPull,
    lastPush: syncState.lastPush,
    sync,
    pull,
    push,
    getSyncStatus,
    cleanupSyncQueue,
    retryFailedSyncItems,
    isOnline,
    networkStatus: status,
  };
}

export function useOnSyncComplete(
  callback: (result: {
    pull: SyncState['lastPull'];
    push: SyncState['lastPush'];
  }) => void
) {
  const { syncState } = useOfflineSync();

  useEffect(() => {
    if (syncState.lastPull && syncState.lastPush && !syncState.isSyncing) {
      callback({ pull: syncState.lastPull, push: syncState.lastPush });
    }
  }, [syncState.lastPull, syncState.lastPush, syncState.isSyncing, callback]);
}
