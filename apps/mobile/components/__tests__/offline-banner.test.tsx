import React from 'react';
import { render } from '@testing-library/react';
import { OfflineBanner } from '@/components/offline-banner';
import { useNetworkStatus, useIsOffline } from '@/lib/hooks/use-network-status';
import { useOfflineSync } from '@/lib/hooks/use-offline-sync';

// Mock hooks
vi.mock('@/lib/hooks/use-network-status', () => ({
  useNetworkStatus: vi.fn(),
  useIsOffline: vi.fn(),
}));

vi.mock('@/lib/hooks/use-offline-sync', () => ({
  useOfflineSync: vi.fn(),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
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
      failedItems: 0,
      latestFailedError: null,
      lastSync: null,
      retryFailedSyncItems: vi.fn(),
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
      failedItems: 0,
      latestFailedError: null,
      lastSync: '2024-01-01T10:00:00Z',
      retryFailedSyncItems: vi.fn(),
    });
    const { getByText } = render(<OfflineBanner />);
    expect(getByText('Online')).toBeDefined();
    expect(getByText(/Last sync:/)).toBeDefined();
    expect(getByText('5')).toBeDefined();
  });

  it('should show ActivityIndicator and disable button when syncing', () => {
    mockUseOfflineSync.mockReturnValue({
      isSyncing: true,
      sync: vi.fn(),
      pendingItems: 1,
      failedItems: 0,
      latestFailedError: null,
      lastSync: null,
      retryFailedSyncItems: vi.fn(),
    });
    const { queryByText } = render(<OfflineBanner />);
    expect(queryByText('Sync')).toBeNull(); // Button text should not be visible
  });

  it('should not show sync button if showSyncButton is false', () => {
    mockUseOfflineSync.mockReturnValue({
      isSyncing: false,
      sync: vi.fn(),
      pendingItems: 1,
      failedItems: 0,
      latestFailedError: null,
      lastSync: null,
      retryFailedSyncItems: vi.fn(),
    });
    const { queryByText } = render(<OfflineBanner showSyncButton={false} />);
    expect(queryByText('Sync')).toBeNull();
  });
});
