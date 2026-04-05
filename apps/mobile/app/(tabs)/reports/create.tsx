import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView } from 'expo-camera';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';
import { generatePDF, savePDF, sharePDF } from '@/lib/utils/pdf-generator';

// Color constants
const COLORS = {
  primary: '#1e40af',
  primaryLight: '#1e40af',
  white: '#ffffff',
  gray: {
    400: '#9ca3af',
    500: '#6b7280',
    600: '#1f2937',
    700: '#e5e7eb',
  },
  success: '#10b981',
  danger: '#ef4444',
  background: '#f9fafb',
  overlay: 'rgba(0, 0, 0, 0.8)',
};

interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
}

export default function CreateReportScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Barcode scanner hook
  const {
    hasPermission,
    isScanning,
    scannedBarcode,
    cameraRef,
    requestPermission,
    handleBarCodeScanned,
    openSettings,
    reset: resetScanner,
    startScanning: startScanner,
    stopScanning: stopScanner,
  } = useBarcodeScanner();

  // Load parts from local database (simulated)
  const [parts, setParts] = useState<{ id: string; name: string; barcode: string }[]>([]);

  useEffect(() => {
    // Load demo parts
    setParts([
      { id: '1', name: 'Circuit Breaker 16A', barcode: '5901234123457' },
      { id: '2', name: 'Circuit Breaker 32A', barcode: '5901234123458' },
      { id: '3', name: 'Cable 2.5mm² 50m', barcode: '5901234123459' },
    ]);
  }, []);

  // Handle barcode scan result
  useEffect(() => {
    if (scannedBarcode) {
      const part = parts.find(p => p.barcode === scannedBarcode.data);
      if (part) {
        Alert.alert('Part Found', `Part: ${part.name}`, [
          {
            text: 'OK',
            onPress: () => {
              resetScanner();
              startScanner();
            },
          },
        ]);
      } else {
        Alert.alert('Part Not Found', `Barcode: ${scannedBarcode.data}`, [
          {
            text: 'OK',
            onPress: () => {
              resetScanner();
              startScanner();
            },
          },
        ]);
      }
    }
  }, [scannedBarcode, parts, resetScanner, startScanner]);

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const compressedPhoto = await compressImage(asset.uri);
        addPhoto(compressedPhoto);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Pick photo from gallery
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const compressedPhoto = await compressImage(asset.uri);
        addPhoto(compressedPhoto);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  // Compress image before saving
  const compressImage = async (uri: string): Promise<Photo> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        id: Date.now().toString(),
        uri: result.uri,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      // Return original if compression fails
      return {
        id: Date.now().toString(),
        uri,
        width: 0,
        height: 0,
      };
    }
  };

  // Add photo to report
  const addPhoto = (photo: Photo) => {
    if (photos.length >= 10) {
      Alert.alert('Limit Reached', 'Maximum 10 photos allowed');
      return;
    }
    setPhotos([...photos, photo]);
  };

  // Remove photo
  const removePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  // Open barcode scanner
  const openScanner = () => {
    setIsScannerOpen(true);
    startScanner();
  };

  // Close scanner
  const closeScanner = () => {
    setIsScannerOpen(false);
    stopScanner();
    resetScanner();
  };

  // Save report (simulated)
  const saveReport = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Please add at least one photo');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate saving report
      await new Promise(resolve => setTimeout(resolve, 1000));

      const nowIso = new Date().toISOString();
      const reportId = Date.now().toString();
      const pdfUri = await generatePDF({
        id: reportId,
        taskTitle: 'Service Task',
        taskDescription: 'Work report generated from mobile app.',
        taskAddress: 'N/A',
        customerName: 'N/A',
        customerPhone: 'N/A',
        technicianName: 'Technician',
        technicianId: 'mobile-user',
        photos: photos.map(photo => photo.uri),
        formData: {
          photoCount: photos.length.toString(),
          source: 'mobile-app',
        },
        signature: null,
        createdAt: nowIso,
        completedAt: nowIso,
      });

      const savedPdfUri = await savePDF(pdfUri, `report-${reportId}.pdf`);

      Alert.alert(
        'Success',
        'Report saved successfully. PDF protocol was generated.',
        [
          {
            text: 'Share PDF',
            onPress: async () => {
              try {
                await sharePDF(savedPdfUri);
              } catch (error) {
                console.error('Error sharing generated PDF:', error);
                Alert.alert('Sharing unavailable', 'PDF was generated and saved locally.');
              } finally {
                router.push('/reports');
              }
            },
          },
          {
            text: 'Done',
            onPress: () => router.push('/reports'),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Error', 'Failed to save report');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScannerPermissionRetry = async () => {
    const granted = await requestPermission();
    if (granted) {
      startScanner();
    }
  };

  if (isScannerOpen) {
    if (hasPermission === null) {
      return (
        <View style={styles.container}>
          <View style={styles.scannerContainer}>
            <ActivityIndicator size="large" color="#1e40af" />
            <Text style={styles.scannerText}>Checking camera permission...</Text>
          </View>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={closeScanner} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#1e40af" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Barcode Scanner</Text>
            <View style={styles.spacer} />
          </View>
          <View style={styles.scannerContainer}>
            <Ionicons name="camera-outline" size={64} color="#ef4444" />
            <Text style={styles.scannerText}>Camera permission is required to scan part barcodes.</Text>
            <TouchableOpacity style={styles.scanButton} onPress={handleScannerPermissionRetry}>
              <Text style={styles.scanButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={closeScanner} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Barcode Scanner</Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.inlineScannerCameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.inlineScannerCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'qr', 'code128', 'code39', 'upc_e', 'upc_a', 'datamatrix', 'pdf417', 'aztec'],
            }}
            onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          />
          <View style={styles.inlineScannerOverlay}>
            <View style={styles.inlineScannerFrame} />
            <Text style={styles.inlineScannerHelpText}>Align barcode inside frame</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1e40af" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Report</Text>
        <View style={styles.spacer} />
      </View>

      {/* Task Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Task</Text>
        <TouchableOpacity style={styles.selectButton} onPress={() => {}}>
          <Ionicons name="list-outline" size={20} color="#6b7280" />
          <Text style={styles.selectButtonText}>Choose task...</Text>
          <Ionicons name="chevron-down" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputPlaceholder}>Enter work description...</Text>
        </View>
      </View>

      {/* Photo Documentation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photo Documentation</Text>
        <View style={styles.photoContainer}>
          {photos.map(photo => (
            <View key={photo.id} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(photo.id)}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color="#1e40af" />
            <Text style={styles.addPhotoText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addPhotoButton} onPress={pickPhoto}>
            <Ionicons name="images" size={32} color="#1e40af" />
            <Text style={styles.addPhotoText}>From Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scan Part Barcode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan Part Barcode</Text>
        <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
          <Ionicons name="barcode" size={24} color="#ffffff" />
          <Text style={styles.scanButtonText}>Scan Part Barcode</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, photos.length === 0 && styles.saveButtonDisabled]}
          onPress={saveReport}
          disabled={photos.length === 0 || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addPhotoButton: {
    alignItems: 'center',
    borderColor: COLORS.gray[700],
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 100,
    justifyContent: 'center',
    width: 100,
  },
  addPhotoText: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 8,
  },
  backButton: {
    padding: 8,
  },
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
      inlineScannerCamera: {
        flex: 1,
      },
      inlineScannerCameraContainer: {
        backgroundColor: '#000000',
        flex: 1,
        position: 'relative',
      },
      inlineScannerFrame: {
        borderColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 2,
        height: 220,
        width: 220,
      },
      inlineScannerHelpText: {
        color: '#ffffff',
        fontSize: 14,
        marginTop: 16,
      },
      inlineScannerOverlay: {
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
  header: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.gray[700],
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: COLORS.gray[600],
    fontSize: 18,
    fontWeight: '600',
  },
  inputContainer: {
    borderColor: COLORS.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 100,
    padding: 12,
  },
  inputPlaceholder: {
    color: COLORS.gray[400],
    fontSize: 14,
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    height: 100,
    position: 'relative',
    width: 100,
  },
  photoPreview: {
    borderRadius: 8,
    height: 100,
    width: 100,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -8,
    top: -8,
    width: 24,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
  },
  saveButtonContainer: {
    padding: 16,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.gray[400],
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 12,
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scannerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  scannerText: {
    color: COLORS.gray[500],
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    backgroundColor: COLORS.white,
    marginBottom: 16,
    padding: 16,
  },
  settingsButton: {
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  settingsButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    color: COLORS.gray[600],
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectButton: {
    alignItems: 'center',
    borderColor: COLORS.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  selectButtonText: {
    color: COLORS.gray[500],
    flex: 1,
    fontSize: 14,
    marginLeft: 12,
  },
  spacer: {
    width: 24,
  },
});