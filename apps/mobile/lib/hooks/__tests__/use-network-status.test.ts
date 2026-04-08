import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNetworkStatus, useIsOnline, useIsOffline, useOnOnline, useOnOffline } from '../use-network-status';

const netInfoMock = vi.hoisted(() => ({
  fetch: vi.fn(),
  addEventListener: vi.fn(),
  remove: vi.fn(),
}));

// Mock dependencies
vi.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: netInfoMock,
  NetInfoState: {
    type: {
      unknown: 'unknown',
      none: 'none',
      cellular: 'cellular',
      wifi: 'wifi',
      bluetooth: 'bluetooth',
      ethernet: 'ethernet',
      wimax: 'wimax',
      vpn: 'vpn',
      other: 'other',
    },
  },
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useNetworkStatus', () => {
    it('should return initial state as unknown', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: null,
        details: null,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.status).toBe('unknown');
      });
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isInternetReachable).toBeNull();
    });

    it('should return online status when connected and internet reachable', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        details: { ssid: 'TestWifi' },
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.status).toBe('online');
      });
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isInternetReachable).toBe(true);
    });

    it('should return offline status when not connected', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.status).toBe('offline');
      });
      expect(result.current.isConnected).toBe(false);
    });

    it('should return offline status when internet not reachable', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
        details: { ssid: 'TestWifi' },
      });

      const { result } = renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.status).toBe('offline');
      });
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('useIsOnline', () => {
    it('should return true when online and connected', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        details: null,
      });

      const { result } = renderHook(() => useIsOnline());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should return false when offline', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });

      const { result } = renderHook(() => useIsOnline());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should return false when not connected even if internet reachable', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: true,
        details: null,
      });

      const { result } = renderHook(() => useIsOnline());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('useIsOffline', () => {
    it('should return true when offline', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });

      const { result } = renderHook(() => useIsOffline());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should return false when online', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        details: null,
      });

      const { result } = renderHook(() => useIsOffline());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('useOnOnline', () => {
    it('should trigger callback when status becomes online', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        details: null,
      });

      const callback = vi.fn();
      renderHook(() => useOnOnline(callback));

      await waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('useOnOffline', () => {
    it('should trigger callback when status becomes offline', async () => {
      (netInfoMock.fetch as unknown as Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });

      const callback = vi.fn();
      renderHook(() => useOnOffline(callback));

      await waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });
});