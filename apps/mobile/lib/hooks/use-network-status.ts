import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

interface NetworkInfo {
  status: NetworkStatus;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  details: NetInfoState['details'] | null;
}

// Maintain a single subscription across hook instances
let netInfoSubscription: (() => void) | null = null;
let netInfoListeners: ((state: NetInfoState) => void)[] = [];

/**
 * Hook to monitor network status with internet connectivity check
 * Returns reactive online/offline state with detailed connection info
 */
export function useNetworkStatus(): NetworkInfo {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    status: 'unknown',
    isConnected: false,
    isInternetReachable: null,
    details: null,
  });

  const updateNetworkInfo = useCallback((state: NetInfoState) => {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable ?? null;

    let status: NetworkStatus = 'unknown';

    if (isConnected && isInternetReachable) {
      status = 'online';
    } else if (!isConnected || isInternetReachable === false) {
      status = 'offline';
    }

    setNetworkInfo({
      status,
      isConnected,
      isInternetReachable,
      details: state.details,
    });
  }, []);

  useEffect(() => {
    // Add this hook's update function to the listeners
    netInfoListeners.push(updateNetworkInfo);

    // If this is the first listener, establish the subscription
    if (netInfoListeners.length === 1) {
      // Get initial state
      NetInfo.fetch().then(initialState => {
        // Update all listeners with the initial state
        netInfoListeners.forEach(listener => listener(initialState));
      });
      
      // Subscribe to changes
      netInfoSubscription = NetInfo.addEventListener(state => {
        // Update all listeners when state changes
        netInfoListeners.forEach(listener => listener(state));
      });
    }

    return () => {
      // Remove this hook's update function from the listeners
      netInfoListeners = netInfoListeners.filter(listener => listener !== updateNetworkInfo);
      
      // If no more listeners, clean up subscription
      if (netInfoListeners.length === 0 && netInfoSubscription) {
        netInfoSubscription();
        netInfoSubscription = null;
      }
    };
  }, [updateNetworkInfo]);

  return networkInfo;
}

/**
 * Hook that returns true if device is online
 */
export function useIsOnline(): boolean {
  const { status, isConnected } = useNetworkStatus();
  return status === 'online' && isConnected;
}

/**
 * Hook that returns true if device is offline
 */
export function useIsOffline(): boolean {
  const { status } = useNetworkStatus();
  return status === 'offline';
}

/**
 * Hook to trigger callback when network status changes from offline to online
 */
export function useOnOnline(callback: () => void): void {
  const { status } = useNetworkStatus();

  useEffect(() => {
    if (status === 'online') {
      callback();
    }
  }, [status, callback]);
}

/**
 * Hook to trigger callback when network status changes from online to offline
 */
export function useOnOffline(callback: () => void): void {
  const { status } = useNetworkStatus();

  useEffect(() => {
    if (status === 'offline') {
      callback();
    }
  }, [status, callback]);
}
