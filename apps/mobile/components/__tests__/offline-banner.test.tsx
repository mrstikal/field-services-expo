import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OfflineBanner } from '@/components/offline-banner';
import { useNetworkStatus, useIsOffline } from '@/lib/hooks/use-network-status';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import type { Mock } from 'vitest';

// Mock hooks
vi.mock('@/lib/hooks/use-network-status', () => ({
  useNetworkStatus: vi.fn(),
  useIsOffline: vi.fn(),
}));

vi.mock('@/lib/hooks/use-offline-sync', () => ({
  useOfflineSync: vi.fn(),
}));

describe('OfflineBanner', () => {
  const mockUseNetworkStatus = useNetworkStatus as unknown as ReturnType<
    typeof vi.fn
  >;
  const mockUseIsOffline = useIsOffline as unknown as ReturnType<typeof vi.fn>;
  const mockUseOfflineSync = useOfflineSync as unknown as ReturnType<
    typeof vi.fn
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockUseNetworkStatus.mockReturnValue({ status: 'online' });
    mockUseIsOffline.mockReturnValue(false);
    mockUseOfflineSync.mockReturnValue({
      isSyncing: false,
      sync: vi.fn(),
      pendingItems: 0,
      lastSync: null,
    });
  });

  it('should not render if online and no pending items', () => {
    const { queryByText } = render(<OfflineBanner />);
    expect(queryByText('Offline')).toBeNull();
    expect(queryByText('Online')).toBeNull();
  });

  it('should show offline banner when offline', () => {
    mockUseIsOffline.mockReturnValue(true);
    mockUseNetworkStatus.mockReturnValue({ status: 'offline' });
    const { getByText } = render(<OfflineBanner />);
    expect(getByText('Offline')).toBeDefined();
    expect(getByText('Changes will sync when online')).toBeDefined();
  });

  it('should show online banner with pending items', () => {
    mockUseOfflineSync.mockReturnValue({
      isSyncing: false,
      sync: vi.fn(),
      pendingItems: 5,
      lastSync: '2024-01-01T10:00:00Z',
    });
    const { getByText } = render(<OfflineBanner />);
    expect(getByText('Online')).toBeDefined();
    expect(getByText('Last sync: 10:00:00 AM')).toBeDefined();
    expect(getByText('5')).toBeDefined();
  });

  it('should call sync function when sync button is pressed', () => {
    const mockSync = vi.fn();
    mockUseOfflineSync.mockReturnValue({
      isSyncing: false,
      sync: mockSync,
      pendingItems: 1,
      lastSync: null,
    });
    const { getByText } = render(<OfflineBanner />);
    fireEvent.press(getByText('Sync'));
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('should show ActivityIndicator and disable button when syncing', () => {
    mockUseOfflineSync.mockReturnValue({
      isSyncing: true,
      sync: vi.fn(),
      pendingItems: 1,
      lastSync: null,
    });
    const { getByText, queryByText, queryByTestId } = render(<OfflineBanner />);
    expect(queryByText('Sync')).toBeNull(); // Button text should not be visible
    expect(queryByTestId('ActivityIndicator')).toBeDefined(); // Check for ActivityIndicator
    expect(getByText('Sync').props.accessibilityState.disabled).toBe(true); // Check if button is disabled
  });

  it('should not show sync button if showSyncButton is false', () => {
    mockUseOfflineSync.mockReturnValue({
      isSyncing: false,
      sync: vi.fn(),
      pendingItems: 1,
      lastSync: null,
    });
    const { queryByText } = render(<OfflineBanner showSyncButton={false} />);
    expect(queryByText('Sync')).toBeNull();
  });
});
