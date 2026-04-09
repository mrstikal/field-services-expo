import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_BARCODE_TYPES } from '@/lib/hooks/barcode-scanner.types';
import { CameraErrorBoundary } from '@/components/error-boundary';

export interface ReportScannerContentProps {
  readonly hasPermission: boolean | null;
  readonly isScannerOpen: boolean;
  readonly isScanning: boolean;
  readonly insetsTop: number;
  readonly insetsBottom: number;
  readonly scannerNotice: {
    type: 'success' | 'error';
    message: string;
  } | null;
  readonly cameraRef: React.RefObject<CameraView | null>;
  readonly onClose: () => void;
  readonly onRetryPermission: () => Promise<void>;
  readonly onOpenSettings: () => void;
  readonly onResumeScanner: () => void;
  readonly onBarcodeScanned:
    | ((...args: Parameters<NonNullable<React.ComponentProps<typeof CameraView>['onBarcodeScanned']>>) => void)
    | undefined;
}

export function ReportScannerContent({
  hasPermission,
  isScannerOpen,
  isScanning,
  insetsTop,
  insetsBottom,
  scannerNotice,
  cameraRef,
  onClose,
  onRetryPermission,
  onOpenSettings,
  onResumeScanner,
  onBarcodeScanned,
}: ReportScannerContentProps) {
  if (hasPermission === null) {
    return (
      <View className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator color="#1e40af" size="large" />
          <Text className="mb-6 text-center text-base text-gray-500">
            Checking camera permission...
          </Text>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <TouchableOpacity className="p-2" onPress={onClose}>
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            Barcode Scanner
          </Text>
          <View className="w-6" />
        </View>
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons color="#ef4444" name="camera-outline" size={64} />
          <Text className="mb-6 text-center text-base text-gray-500">
            Camera permission is required to scan part barcodes.
          </Text>
          <TouchableOpacity
            className="flex-row items-center justify-center rounded-lg bg-blue-800 p-3"
            onPress={() => {
              void onRetryPermission();
            }}
          >
            <Text className="text-sm font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-3 rounded-lg border border-blue-800 px-4 py-2.5"
            onPress={onOpenSettings}
          >
            <Text className="text-sm font-semibold text-blue-800">
              Open Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <CameraErrorBoundary>
      <View className="flex-1 bg-slate-50">
        <View
          className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
          style={{ paddingTop: insetsTop }}
        >
          <TouchableOpacity className="p-2" onPress={onClose}>
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            Barcode Scanner
          </Text>
          <View className="w-6" />
        </View>
        <View
          className="relative flex-1 bg-black"
          style={{ paddingBottom: insetsBottom }}
        >
          <CameraView
            active={isScannerOpen}
            barcodeScannerSettings={{
              barcodeTypes: [...SUPPORTED_BARCODE_TYPES],
            }}
            className="flex-1"
            facing="back"
            onBarcodeScanned={isScanning ? onBarcodeScanned : undefined}
            ref={cameraRef}
          />
          <View className="pointer-events-none absolute inset-0 items-center justify-center">
            <View className="h-[220px] w-[220px] rounded-xl border-2 border-white/80" />
            <Text className="mt-4 text-sm text-white/80">
              Align barcode inside frame
            </Text>
          </View>

          {scannerNotice ? (
            <View
              className={`absolute bottom-5 left-4 right-4 rounded-lg px-4 py-3 ${
                scannerNotice.type === 'error' ? 'bg-red-900' : 'bg-emerald-800'
              }`}
            >
              <Text className="text-sm text-white">{scannerNotice.message}</Text>
            </View>
          ) : null}
        </View>

        {!isScanning ? (
          <View className="bg-slate-50 px-4 pb-4">
            <TouchableOpacity
              className="rounded-lg bg-blue-800 p-3"
              onPress={onResumeScanner}
            >
              <Text className="text-center text-sm font-semibold text-white">
                Scan again
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </CameraErrorBoundary>
  );
}
