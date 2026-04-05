import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNetworkStatus, useIsOffline } from '@/lib/hooks/use-network-status';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { Ionicons } from '@expo/vector-icons';

interface OfflineBannerProps {
  readonly showSyncButton?: boolean;
}

/**
 * Offline Banner Component
 * Shows network status and sync status
 */
export function OfflineBanner({ showSyncButton = true }: OfflineBannerProps) {
  const { status } = useNetworkStatus();
  const { isSyncing, sync, pendingItems, lastSync } = useOfflineSync();
  const isOffline = useIsOffline();

  // Don't show banner if online and no pending items
  if (status === 'online' && pendingItems === 0) {
    return null;
  }

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <View className="flex-row items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
      <View className="flex-1 flex-row items-center gap-2">
        {isOffline ? (
          <>
            <Ionicons color="#ef4444" name="cloud-offline-outline" size={20} />
            <Text className="text-sm font-semibold text-slate-800">Offline</Text>
            <Text className="ml-1 text-xs text-slate-500">Changes will sync when online</Text>
          </>
        ) : (
          <>
            <Ionicons color="#10b981" name="wifi" size={20} />
            <Text className="text-sm font-semibold text-slate-800">Online</Text>
            <Text className="ml-1 text-xs text-slate-500">
              Last sync: {formatLastSync(lastSync)}
            </Text>
          </>
        )}

        {pendingItems > 0 && (
          <View className="ml-2 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
            <Text className="text-xs font-bold text-white">{pendingItems}</Text>
          </View>
        )}
      </View>

      {showSyncButton ? <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center gap-1 rounded bg-blue-800 px-3 py-1.5"
          disabled={isSyncing}
          onPress={sync}
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons color="#fff" name="sync" size={16} />
              <Text className="text-xs font-semibold text-white">Sync</Text>
            </>
          )}
        </TouchableOpacity> : null}
    </View>
  );
}

