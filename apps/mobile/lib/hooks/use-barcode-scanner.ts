import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Camera from 'expo-camera';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';

export type BarcodeType = 'ean-13' | 'qr' | 'code-128' | 'code-39' | 'upc_e' | 'upc_a' | 'data_MATRIX' | 'pdf417' | 'aztec';

export interface BarcodeResult {
  data: string;
  type: BarcodeType;
}

type BarCodeScannedCallback = (result: { type: string; data: string }) => void;

interface UseBarcodeScannerReturn {
  hasPermission: boolean | null;
  isScanning: boolean;
  scannedBarcode: BarcodeResult | null;
  cameraRef: React.RefObject<Camera.CameraView | null>;
  requestPermission: () => Promise<boolean>;
  startScanning: () => void;
  stopScanning: () => void;
  reset: () => void;
  openSettings: () => Promise<void>;
  handleBarCodeScanned: BarCodeScannedCallback;
}

/**
 * Custom hook for barcode scanning functionality
 * Handles permissions, scanning state, and barcode detection
 */
export function useBarcodeScanner(): UseBarcodeScannerReturn {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedBarcode, setScannedBarcode] = useState<BarcodeResult | null>(null);
  const cameraRef = React.useRef<Camera.CameraView>(null);
  const scanResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use the useCameraPermissions hook from expo-camera
  const [permissionResponse, requestPermission] = useCameraPermissions();

  // Request camera permissions on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    return () => {
      if (scanResetTimeoutRef.current) {
        clearTimeout(scanResetTimeoutRef.current);
      }
    };
  }, []);

  // Update hasPermission state based on permission response
  useEffect(() => {
    if (permissionResponse) {
      setHasPermission(permissionResponse.granted);
    }
  }, [permissionResponse]);

   // Handle barcode scan
   const handleBarCodeScanned: BarCodeScannedCallback = useCallback(
     (result: { type: string; data: string }) => {
       // Prevent multiple scans of the same barcode
       if (scannedBarcode?.data === result.data) {
         return;
       }

       // Haptic feedback for successful scan
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

       setScannedBarcode({ data: result.data, type: result.type as BarcodeType });
       setIsScanning(false);

       if (scanResetTimeoutRef.current) {
         clearTimeout(scanResetTimeoutRef.current);
       }

       // Auto-reset after 1 second to allow fast repeated scans
       scanResetTimeoutRef.current = setTimeout(() => {
         setScannedBarcode(null);
         setIsScanning(true);
       }, 1000);
     },
     [scannedBarcode?.data]
   );

  // Start scanning
  const startScanning = useCallback(() => {
    setIsScanning(true);
    setScannedBarcode(null);
  }, []);

  // Stop scanning
  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  // Reset scanner state
  const reset = useCallback(() => {
    setScannedBarcode(null);
    setIsScanning(false);
  }, []);

  // Open app settings for permission
  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Unable to open app settings:', error);
    }
  }, []);

  const requestPermissionRetry = useCallback(async () => {
    const response = await requestPermission();
    setHasPermission(response.granted);
    return response.granted;
  }, [requestPermission]);

  return {
    hasPermission,
    isScanning,
    scannedBarcode,
    cameraRef,
    requestPermission: requestPermissionRetry,
    startScanning,
    stopScanning,
    reset,
    openSettings,
    handleBarCodeScanned,
  };
}

export default useBarcodeScanner;