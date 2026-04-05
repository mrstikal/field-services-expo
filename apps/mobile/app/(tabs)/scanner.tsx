import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';

// Color constants
const COLORS = {
  primary: '#1e40af',
  white: '#ffffff',
  gray: {
    400: '#9ca3af',
  },
  danger: '#ef4444',
  black: '#000000',
};

export default function ScannerScreen() {
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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
         <Ionicons name="camera-outline" size={64} color="#ef4444" />
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.subtitle}>
          Please enable camera access in settings to use barcode scanner
        </Text>
        <View style={styles.permissionActions}>
          <TouchableOpacity style={styles.button} onPress={handlePermissionRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backTextButton} onPress={handleCancel}>
            <Text style={styles.backTextButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Barcode Scanner</Text>
        <TouchableOpacity onPress={toggleFlash} style={styles.flashButton}>
          <Ionicons
            name={flashEnabled ? 'flash' : 'flash-off'}
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flashEnabled ? 'on' : 'off'}
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
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
        />

        {/* Overlay Frame */}
        <View style={styles.overlay}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.overlayText}>Align barcode within the frame</Text>
        </View>

        {/* Scanning Line Animation */}
        {isScanning && (
          <View style={styles.scanningLine}>
            <View style={styles.scanningLineBar} />
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Ionicons name="close" size={20} color="#ef4444" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
  },
  backTextButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backTextButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  bottomLeft: {
    borderBottomLeftRadius: 8,
    borderColor: COLORS.primary,
    borderWidth: 3,
    bottom: -2,
    left: -2,
  },
  bottomRight: {
    borderBottomRightRadius: 8,
    borderColor: COLORS.primary,
    borderWidth: 3,
    bottom: -2,
    right: -2,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cancelButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  container: {
    backgroundColor: COLORS.black,
    flex: 1,
  },
  corner: {
    height: 20,
    position: 'absolute',
    width: 20,
  },
  flashButton: {
    padding: 8,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  frame: {
    borderColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    height: 200,
    position: 'relative',
    width: 200,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 16,
  },
      permissionActions: {
        alignItems: 'center',
        marginTop: 16,
      },
      settingsButton: {
        borderColor: COLORS.white,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
      },
      settingsButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
      },
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    position: 'absolute',
  },
  overlayText: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 24,
    opacity: 0.8,
    textAlign: 'center',
  },
  scanningLine: {
    height: 2,
    position: 'absolute',
    width: '100%',
  },
  scanningLineBar: {
    backgroundColor: COLORS.primary,
    height: '100%',
    width: '100%',
  },
  subtitle: {
    color: COLORS.gray[400],
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  topLeft: {
    borderColor: COLORS.primary,
    borderTopLeftRadius: 8,
    borderWidth: 3,
    left: -2,
    top: -2,
  },
  topRight: {
    borderColor: COLORS.primary,
    borderTopRightRadius: 8,
    borderWidth: 3,
    right: -2,
    top: -2,
  },
});
