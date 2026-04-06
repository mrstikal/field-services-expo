import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    hasPermission,
    isScanning,
    scannedBarcode,
    cameraRef,
    requestPermission,
    startScanning,
    stopScanning,
    reset,
    openSettings,
    handleBarCodeScanned,
  } = useBarcodeScanner();

  const [flashEnabled, setFlashEnabled] = useState(false);

  // Auto-start scanning when component mounts
  useEffect(() => {
    if (hasPermission) {
      startScanning();
    }
  }, [hasPermission, startScanning]);

  // Handle barcode scan result
  useEffect(() => {
    if (scannedBarcode) {
      Alert.alert(
        'Barcode Scanned',
        `Type: ${scannedBarcode.type}\nData: ${scannedBarcode.data}`,
        [
          {
            text: 'OK',
            onPress: () => {
              reset();
              startScanning();
            },
          },
        ]
      );
    }
  }, [scannedBarcode, reset, startScanning]);

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  const handleCancel = () => {
    stopScanning();
    router.back();
  };

  const handlePermissionRetry = async () => {
    const granted = await requestPermission();
    if (granted) {
      startScanning();
    }
  };

  if (hasPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#1e40af" size="large" />
        <Text className="mt-4 text-base text-white">Checking camera permissions...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Ionicons color="#ef4444" name="camera-outline" size={64} />
        <Text className="mt-4 text-center text-xl font-semibold text-white">Camera Permission Required</Text>
        <Text className="mt-2 text-center text-sm text-gray-400">
          Please enable camera access in settings to use barcode scanner
        </Text>
        <View className="mt-4 items-center">
          <TouchableOpacity className="mt-6 rounded-lg bg-blue-800 px-6 py-3" onPress={handlePermissionRetry}>
            <Text className="text-base font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3 rounded-lg border border-white px-6 py-3" onPress={openSettings}>
            <Text className="text-base font-semibold text-white">Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3 px-4 py-2" onPress={handleCancel}>
            <Text className="text-sm font-medium text-white">Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity className="p-2" onPress={handleCancel}>
          <Ionicons color="#ffffff" name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-white">Barcode Scanner</Text>
        <TouchableOpacity className="p-2" onPress={toggleFlash}>
          <Ionicons
            color="#ffffff"
            name={flashEnabled ? 'flash' : 'flash-off'}
            size={24}
          />
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View className="relative flex-1">
        <CameraView
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13',
              'qr',
              'code128',
              'code39',
              'upc_e',
              'upc_a',
              'datamatrix',
              'pdf417',
              'aztec',
            ],
          }}
          className="flex-1"
          facing="back"
          flash={flashEnabled ? 'on' : 'off'}
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          ref={cameraRef}
        />

        {/* Overlay Frame */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="relative h-[200px] w-[200px] rounded-2xl border-2 border-white">
            <View className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-tl-lg border-[3px] border-blue-800" />
            <View className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-tr-lg border-[3px] border-blue-800" />
            <View className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-lg border-[3px] border-blue-800" />
            <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-lg border-[3px] border-blue-800" />
          </View>
          <Text className="mt-6 text-center text-sm text-white/80">Align barcode within the frame</Text>
        </View>

        {/* Scanning Line Animation */}
        {isScanning ? <View className="absolute h-0.5 w-full bg-blue-800" /> : null}
      </View>

      {/* Footer */}
      <View className="items-center justify-center p-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <TouchableOpacity className="flex-row items-center justify-center" onPress={handleCancel}>
          <Ionicons color="#ef4444" name="close" size={20} />
          <Text className="ml-2 text-base font-semibold text-red-500">Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
