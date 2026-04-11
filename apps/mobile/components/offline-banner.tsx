import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { useNetworkStatus, useIsOffline } from '@/lib/hooks/use-network-status';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OfflineBannerProps {
  readonly showSyncButton?: boolean;
}

/**
 * Offline Banner Component
 * Shows network status and sync status with improved animations
 */
export function OfflineBanner({ showSyncButton = true }: OfflineBannerProps) {
  const insets = useSafeAreaInsets();
  const { status } = useNetworkStatus();
  const {
    isSyncing,
    sync,
    pendingItems,
    failedItems,
    latestFailedError,
    lastSync,
    retryFailedSyncItems,
  } = useOfflineSync();
  const isOffline = useIsOffline();

  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const safeAreaStyles = useRef(
    StyleSheet.create({
      contentInset: {
        paddingTop: insets.top + 12,
      },
    })
  );

  useEffect(() => {
    safeAreaStyles.current = StyleSheet.create({
      contentInset: {
        paddingTop: insets.top + 12,
      },
    });
  }, [insets.top]);

  useEffect(() => {
    if (isOffline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOffline, pulseAnim]);

  // Don't show banner if online and no queued issues.
  if (status === 'online' && pendingItems === 0 && failedItems === 0) {
    return null;
  }

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handleSyncPress = async () => {
    if (failedItems > 0) {
      await retryFailedSyncItems(Number.POSITIVE_INFINITY);
    }
    await sync();
  };

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View
        className="border-b border-slate-200 bg-slate-50 px-4 py-3"
        style={safeAreaStyles.current.contentInset}
        testID="offline-banner"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            {isOffline ? (
              <>
                <Animated.View style={{ opacity: pulseAnim }}>
                  <Ionicons
                    color="#ef4444"
                    name="cloud-offline-outline"
                    size={20}
                  />
                </Animated.View>
                <Text
                  className="text-sm font-semibold text-slate-800"
                  testID="offline-banner-offline-text"
                >
                  Offline
                </Text>
                <Text className="ml-1 text-xs text-slate-500">
                  Changes will sync when online
                </Text>
              </>
            ) : (
              <>
                <Ionicons color="#10b981" name="wifi" size={20} />
                <Text className="text-sm font-semibold text-slate-800">
                  Online
                </Text>
                <Text className="ml-1 text-xs text-slate-500">
                  Last sync: {formatLastSync(lastSync)}
                </Text>
                {failedItems > 0 ? (
                  <Text className="ml-2 text-xs font-semibold text-red-600">
                    {failedItems} failed
                  </Text>
                ) : null}
              </>
            )}

            {pendingItems > 0 && (
              <View className="ml-2 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
                <Text className="text-xs font-bold text-white">
                  {pendingItems}
                </Text>
              </View>
            )}
          </View>

          {showSyncButton ? (
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center gap-1 rounded bg-blue-800 px-3 py-1.5"
              disabled={isSyncing}
              onPress={handleSyncPress}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons color="#fff" name="sync" size={16} />
                  <Text className="text-xs font-semibold text-white">
                    {failedItems > 0 ? 'Retry' : 'Sync'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {failedItems > 0 && latestFailedError ? (
          <View className="mt-2">
            <Text className="text-xs text-red-600">{latestFailedError}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 999,
  },
});
