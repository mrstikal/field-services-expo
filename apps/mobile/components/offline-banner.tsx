import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNetworkStatus, useIsOffline } from '@/lib/hooks/use-network-status';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { Ionicons } from '@expo/vector-icons';

interface OfflineBannerProps {
  showSyncButton?: boolean;
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
    <View style={styles.container}>
      <View style={styles.content}>
        {isOffline ? (
          <>
            <Ionicons name="cloud-offline-outline" size={20} color="#ef4444" />
            <Text style={styles.statusText}>Offline</Text>
            <Text style={styles.subtext}>Changes will sync when online</Text>
          </>
        ) : (
          <>
            <Ionicons name="wifi" size={20} color="#10b981" />
            <Text style={styles.statusText}>Online</Text>
            <Text style={styles.subtext}>
              Last sync: {formatLastSync(lastSync)}
            </Text>
          </>
        )}

        {pendingItems > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingItems}</Text>
          </View>
        )}
      </View>

      {showSyncButton && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={sync}
          disabled={isSyncing}
          activeOpacity={0.7}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sync" size={16} color="#fff" />
              <Text style={styles.syncButtonText}>Sync</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  subtext: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  pendingBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});