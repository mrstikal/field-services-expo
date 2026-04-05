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

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  pendingBadge: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 20,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '600',
  },
  subtext: {
    color: '#64748b',
    fontSize: 12,
    marginLeft: 4,
  },
  syncButton: {
    alignItems: 'center',
    backgroundColor: '#1e40af',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});