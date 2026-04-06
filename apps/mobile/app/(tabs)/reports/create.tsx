import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView } from 'expo-camera';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';
import { supabase } from '@/lib/supabase';
import { generatePDF, sharePDF } from '@/lib/utils/pdf-generator';
import { uploadPhoto, uploadPDF, uploadSignature } from '@/lib/utils/storage';
import { detectObjects, suggestFormFields } from '@/lib/utils/vision-detection';
import { Task, TaskCategory } from '@field-service/shared-types';
import { formTemplates } from '@/lib/validators/report-schemas';
import { DynamicForm, DynamicFormHandle } from '@/components/report/DynamicForm';
import { SignaturePad } from '@/components/report/SignaturePad';
import { TaskSelector } from '@/components/report/TaskSelector';

interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
}

export default function CreateReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const dynamicFormRef = useRef<DynamicFormHandle | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSignatureOpen, setIsSignatureOpen] = useState<boolean>(false);
  const [isVisionProcessing, setIsVisionProcessing] = useState<boolean>(false);
  const [detectionValues, setDetectionValues] = useState<Record<string, unknown>>({});

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

  // Add photo to report - store locally, upload to storage only when saving report
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
    // Reset is called after scanner is closed to avoid re-triggering
    setTimeout(() => {
      resetScanner();
    }, 100);
  };

  // Handle signature - upload to storage immediately
  const handleSignature = async (signatureData: string) => {
    if (!selectedTask) {
      Alert.alert('Error', 'Please select a task first');
      return;
    }
    
    setIsProcessing(true);
    try {
      const reportId = Date.now().toString();
      const signatureUrl = await uploadSignature(signatureData, reportId);
      setSignature(signatureUrl);
      setIsSignatureOpen(false);
    } catch (error) {
      console.error('Error uploading signature:', error);
      Alert.alert('Error', 'Failed to upload signature');
    } finally {
      setIsProcessing(false);
    }
  };

  // Vision object detection
  const handleVisionDetection = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo for detection');
      return;
    }

    setIsVisionProcessing(true);
    try {
      const result = await detectObjects(photos[0].uri);
      if (result && result.objects.length > 0) {
        const suggestions = suggestFormFields(result);
        if (suggestions.length > 0) {
          Alert.alert(
            'Auto-Detected Fields',
            'Would you like to auto-fill form fields based on detection?',
            [
              {
                text: 'Yes',
                onPress: () => {
                    const newValues: Record<string, unknown> = {};
                   suggestions.forEach(s => {
                     newValues[s.fieldId] = s.value;
                   });
                   setDetectionValues(newValues);
                },
              },
              { text: 'No', style: 'cancel' },
            ]
          );
        } else {
          Alert.alert('Detection Complete', 'No significant objects detected');
        }
      }
    } catch (error) {
      console.error('Vision detection error:', error);
      Alert.alert('Detection Failed', 'Could not process image for detection');
    } finally {
      setIsVisionProcessing(false);
    }
  };

   // Reset all form state
   const resetCreateReportState = () => {
     setPhotos([]);
     setSelectedTask(null);
     setSignature(null);
     setDetectionValues({});
     if (dynamicFormRef.current) {
       dynamicFormRef.current.resetForm({});
     }
   };

   // Save report
   const handleSaveReport = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Please add at least one photo');
      return;
    }

    if (!selectedTask) {
      Alert.alert('Error', 'Please select a task');
      return;
    }

    setIsProcessing(true);

    try {
      // Submit form data first
      if (dynamicFormRef.current) {
        await dynamicFormRef.current.submitForm();
      }

      const nowIso = new Date().toISOString();
      const reportId = Date.now().toString();

      // Get form data from DynamicForm to ensure we have the latest values
      const formValues = dynamicFormRef.current?.getFormData() || {};
      
      // Prepare form data
      const reportFormData = {
        ...formValues,
        photosCount: photos.length.toString(),
        source: 'mobile-app',
        timestamp: nowIso,
      };

      const pdfUri = await generatePDF({
        id: reportId,
        taskTitle: selectedTask.title,
        taskDescription: selectedTask.description,
        taskAddress: selectedTask.address,
        customerName: selectedTask.customer_name,
        customerPhone: selectedTask.customer_phone,
        technicianName: 'Technician',
        technicianId: 'mobile-user',
        photos: photos.map(photo => photo.uri),
        formData: reportFormData,
        signature: signature,
        createdAt: nowIso,
        completedAt: nowIso,
      });

      // Upload photos to storage
      const photoUrls = await Promise.all(
        photos.map(photo => uploadPhoto(photo.uri, reportId))
      );

      // Upload PDF to storage
      const pdfUrl = await uploadPDF(pdfUri, reportId);

      // Save report to database with public URLs
      // NOTE: pdf URL is stored in form_data to avoid hard dependency on DB schema migration
      const { error: dbError } = await supabase
        .from('reports')
        .insert({
          task_id: selectedTask.id,
          status: 'completed',
          photos: photoUrls,
          form_data: {
            ...reportFormData,
            pdf_url: pdfUrl,
          },
          signature: signature || null,
        });

      if (dbError) {
        console.error('Error saving report to database:', dbError);
        Alert.alert('Error', 'Failed to save report to database');
        return;
      }

       // Invalidate cache to refresh the reports list and tasks list
       await queryClient.invalidateQueries({ queryKey: ['reports'] });
       await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      Alert.alert(
        'Success',
        'Report saved successfully. PDF protocol was generated and uploaded.',
        [
          {
            text: 'View PDF',
            onPress: async () => {
              try {
                await sharePDF(pdfUrl);
              } catch (error) {
                console.error('Error sharing PDF:', error);
                Alert.alert('Error', 'Could not share PDF');
              } finally {
                resetCreateReportState();
                router.push('/reports');
              }
            },
          },
          {
            text: 'Done',
            onPress: () => {
              resetCreateReportState();
              router.push('/reports');
            },
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

  // Get form template based on task category
  const getFormTemplate = useCallback(() => {
    if (!selectedTask) return null;
    return {
      id: 'report-template',
      categoryId: selectedTask.category as TaskCategory,
      name: formTemplates[selectedTask.category as TaskCategory].name,
      fields: formTemplates[selectedTask.category as TaskCategory].fields,
      version: 1,
      created_at: new Date().toISOString(),
    };
  }, [selectedTask]);

  const scannerContent = useMemo(() => {
    if (hasPermission === null) {
      return (
        <View className="flex-1 bg-slate-50">
          <View className="flex-1 items-center justify-center p-8">
            <ActivityIndicator color="#1e40af" size="large" />
            <Text className="mb-6 text-center text-base text-gray-500">Checking camera permission...</Text>
          </View>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View className="flex-1 bg-slate-50">
          <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <TouchableOpacity className="p-2" onPress={closeScanner}>
              <Ionicons color="#1e40af" name="chevron-back" size={24} />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-800">Barcode Scanner</Text>
            <View className="w-6" />
          </View>
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons color="#ef4444" name="camera-outline" size={64} />
            <Text className="mb-6 text-center text-base text-gray-500">Camera permission is required to scan part barcodes.</Text>
            <TouchableOpacity className="flex-row items-center justify-center rounded-lg bg-blue-800 p-3" onPress={handleScannerPermissionRetry}>
              <Text className="text-sm font-semibold text-white">Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity className="mt-3 rounded-lg border border-blue-800 px-4 py-2.5" onPress={openSettings}>
              <Text className="text-sm font-semibold text-blue-800">Open Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3" style={{ paddingTop: insets.top }}>
          <TouchableOpacity className="p-2" onPress={closeScanner}>
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">Barcode Scanner</Text>
          <View className="w-6" />
        </View>
        <View className="flex-1 relative bg-black" style={{ paddingTop: 0, paddingBottom: insets.bottom }}>
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'qr', 'code128', 'code39', 'upc_e', 'upc_a', 'datamatrix', 'pdf417', 'aztec'],
            }}
            style={{ flex: 1 }}
            className="flex-1"
            facing="back"
            onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
            ref={cameraRef}
          />
          <View className="absolute inset-0 items-center justify-center pointer-events-none">
            <View className="h-[220px] w-[220px] rounded-xl border-2 border-white/80 bg-white/10 backdrop-blur-sm" />
            <Text className="mt-4 text-sm text-white/80">Align barcode inside frame</Text>
          </View>
        </View>
      </View>
    );
  }, [hasPermission, closeScanner, handleScannerPermissionRetry, openSettings, insets.top, insets.bottom, isScanning, handleBarCodeScanned, cameraRef]);

  if (isScannerOpen) {
    return scannerContent;
  }

  const formTemplate = getFormTemplate();

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3" style={{ paddingTop: insets.top + 12 }}>
         <TouchableOpacity className="p-2" onPress={() => router.push('/(tabs)/reports')}>
           <Ionicons color="#1e40af" name="chevron-back" size={24} />
         </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">New Report</Text>
        <View className="w-6" />
      </View>

      {/* Task Selection */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">Select Task</Text>
        <TaskSelector onSelectTask={setSelectedTask} selectedTask={selectedTask} />
      </View>

      {/* Vision Detection (only if photos added) */}
      {photos.length > 0 && (
        <View className="mb-4 bg-white p-4">
          <Text className="mb-3 text-base font-semibold text-gray-800">AI Detection</Text>
          <TouchableOpacity
            className={`flex-row items-center justify-center rounded-lg p-3 ${isVisionProcessing ? 'bg-gray-400' : 'bg-blue-800'}`}
            disabled={isVisionProcessing}
            onPress={handleVisionDetection}
          >
            {isVisionProcessing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons color="#ffffff" name="scan" size={24} />
                <Text className="ml-2 text-sm font-semibold text-white">Detect Objects</Text>
              </>
            )}
          </TouchableOpacity>
          <Text className="mt-2 text-center text-xs text-gray-500">
            AI will analyze the first photo and suggest form field values
          </Text>
        </View>
      )}

      {/* Dynamic Form */}
      {formTemplate ? <View className="mb-4 bg-white p-4">
          <Text className="mb-3 text-base font-semibold text-gray-800">Report Details</Text>
            <DynamicForm
              ref={dynamicFormRef}
              defaultValues={detectionValues}
              template={formTemplate}
            />
        </View> : null}

      {/* Signature */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">Customer Signature</Text>
        <TouchableOpacity
          className={`flex-row items-center justify-center rounded-lg border border-dashed p-6 ${signature ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
          onPress={() => setIsSignatureOpen(true)}
        >
          {signature ? (
            <>
              <Ionicons color="#10b981" name="checkmark-circle" size={24} />
              <Text className="ml-2 text-sm font-semibold text-blue-800">Signature Added</Text>
            </>
          ) : (
            <>
              <Ionicons color="#1e40af" name="pencil" size={24} />
              <Text className="ml-2 text-sm font-semibold text-blue-800">Add Customer Signature</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Photo Documentation */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">Photo Documentation</Text>
        <View className="flex-row flex-wrap gap-3">
          {photos.map(photo => (
            <View className="relative h-[100px] w-[100px]" key={photo.id}>
              <Image className="h-[100px] w-[100px] rounded-lg" source={{ uri: photo.uri }} />
              <TouchableOpacity
                className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500"
                onPress={() => removePhoto(photo.id)}
              >
                <Ionicons color="#ffffff" name="close" size={20} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity className="h-[100px] w-[100px] items-center justify-center rounded-lg border border-dashed border-gray-200" onPress={takePhoto}>
            <Ionicons color="#1e40af" name="camera" size={32} />
            <Text className="mt-2 text-xs text-blue-800">Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity className="h-[100px] w-[100px] items-center justify-center rounded-lg border border-dashed border-gray-200" onPress={pickPhoto}>
            <Ionicons color="#1e40af" name="images" size={32} />
            <Text className="mt-2 text-xs text-blue-800">From Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scan Part Barcode */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">Scan Part Barcode</Text>
        <TouchableOpacity className="flex-row items-center justify-center rounded-lg bg-blue-800 p-3" onPress={openScanner}>
          <Ionicons color="#ffffff" name="barcode" size={24} />
          <Text className="ml-2 text-sm font-semibold text-white">Scan Part Barcode</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <View className="p-4">
        <TouchableOpacity
          className={`flex-row items-center justify-center rounded-lg p-4 ${photos.length === 0 ? 'bg-gray-400' : 'bg-blue-800'}`}
          disabled={photos.length === 0 || isProcessing}
          onPress={handleSaveReport}
        >
          {isProcessing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons color="#ffffff" name="checkmark" size={20} />
              <Text className="ml-2 text-base font-semibold text-white">Save Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Signature Modal */}
      <SignaturePad
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onSign={handleSignature}
      />
    </ScrollView>
  );
}

