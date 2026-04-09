import React from 'react';
import { render } from '@testing-library/react';
import { View } from 'react-native';
import { ReportScannerContent } from '@/components/report/ReportScannerContent';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => <View accessibilityLabel={String(name)} />,
}));

vi.mock('expo-camera', () => ({
  CameraView: ({ onBarcodeScanned }: any) => (
    <View
      testID="camera-view"
      accessibilityLabel={onBarcodeScanned ? 'scanner-active' : 'scanner-idle'}
    />
  ),
}));

vi.mock('@/components/error-boundary', () => ({
  CameraErrorBoundary: ({ children }: any) => <>{children}</>,
}));

describe('ReportScannerContent', () => {
  const baseProps = {
    isScannerOpen: true,
    isScanning: true,
    insetsTop: 0,
    insetsBottom: 0,
    scannerNotice: null,
    cameraRef: { current: null },
    onClose: vi.fn(),
    onRetryPermission: vi.fn(async () => {}),
    onOpenSettings: vi.fn(),
    onResumeScanner: vi.fn(),
    onBarcodeScanned: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders permission state when camera permission is missing', () => {
    const { getByText } = render(
      <ReportScannerContent {...baseProps} hasPermission={false} />
    );

    expect(getByText('Camera permission is required to scan part barcodes.')).toBeDefined();
    expect(getByText('Try Again')).toBeDefined();
    expect(getByText('Open Settings')).toBeDefined();
  });

  it('renders active scanner content when permission is granted', () => {
    const { container, getByText } = render(
      <ReportScannerContent {...baseProps} hasPermission />
    );

    expect(container.querySelector('[testid="camera-view"]')).not.toBeNull();
    expect(getByText('Barcode Scanner')).toBeDefined();
    expect(getByText('Align barcode inside frame')).toBeDefined();
  });

  it('shows scan again action when scanner is paused', () => {
    const { getByText } = render(
      <ReportScannerContent
        {...baseProps}
        hasPermission
        isScanning={false}
        scannerNotice={{ type: 'success', message: 'Found part' }}
      />
    );

    expect(getByText('Found part')).toBeDefined();
    expect(getByText('Scan again')).toBeDefined();
  });
});
