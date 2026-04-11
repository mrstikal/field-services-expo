import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';
import { generatePDF, sharePDF } from '@/lib/utils/pdf-generator';
import {
  uploadPhoto,
  uploadPDF,
  uploadSignature,
  deleteStorageFileByPublicUrl,
} from '@/lib/utils/storage';
import { detectObjects, suggestFormFields } from '@/lib/utils/vision-detection';
import { Task, TaskCategory } from '@field-service/shared-types';
import { formTemplates } from '@/lib/validators/report-schemas';
import {
  DynamicForm,
  DynamicFormHandle,
} from '@/components/report/DynamicForm';
import { ReportScannerContent } from '@/components/report/ReportScannerContent';
import { SignaturePad } from '@/components/report/SignaturePad';
import { TaskSelector } from '@/components/report/TaskSelector';
import { FileSystemErrorBoundary } from '@/components/error-boundary';
import { reportRepository } from '@/lib/db/report-repository';
import { useAuth } from '@/lib/auth-context';
import {
  appendPhoto,
  createPhotoId,
  createReportId,
  removePhotoById,
} from './create.utils';

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
  const { user } = useAuth();
  const dynamicFormRef = useRef<DynamicFormHandle | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scannerLifecycleRef = useRef(false);
  const signatureUrlRef = useRef<string | null>(null);
  const hasPersistedCurrentReportRef = useRef(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSignatureOpen, setIsSignatureOpen] = useState<boolean>(false);
  const [isVisionProcessing, setIsVisionProcessing] = useState<boolean>(false);
  const [detectionValues, setDetectionValues] = useState<
    Record<string, unknown>
  >({});
  const [reportFormDraft, setReportFormDraft] = useState<
    Record<string, unknown>
  >({});
  const [scannerNotice, setScannerNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [scannedParts, setScannedParts] = useState<
    Array<{ id: string; name: string; barcode: string }>
  >([]);
  const [formSectionY, setFormSectionY] = useState(0);
  const [currentReportId, setCurrentReportId] = useState<string>(() =>
    createReportId()
  );
  const [isRequiredFormValid, setIsRequiredFormValid] = useState(false);

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
  const [parts, setParts] = useState<
    { id: string; name: string; barcode: string }[]
  >([]);

  useEffect(() => {
    // Load demo parts
    setParts([
      { id: '1', name: 'Circuit Breaker 16A', barcode: '5901234123457' },
      { id: '2', name: 'Circuit Breaker 32A', barcode: '5901234123458' },
      { id: '3', name: 'Cable 2.5mm² 50m', barcode: '5901234123459' },
    ]);
  }, []);

  useEffect(() => {
    signatureUrlRef.current = signature;
  }, [signature]);

  const cleanupUploadedSignature = useCallback(
    async (publicUrl?: string | null) => {
      if (!publicUrl) {
        return;
      }

      await deleteStorageFileByPublicUrl(publicUrl);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (!hasPersistedCurrentReportRef.current && signatureUrlRef.current) {
        void cleanupUploadedSignature(signatureUrlRef.current);
      }
    };
  }, [cleanupUploadedSignature]);

  const appendScannedPartToForm = useCallback(
    (partName: string): boolean => {
      if (!selectedTask) {
        return false;
      }

      const template = formTemplates[selectedTask.category as TaskCategory];
      const hasPartsField = template.fields.some(
        field => field.id === 'parts_replaced'
      );
      if (!hasPartsField) {
        return false;
      }

      setReportFormDraft(previousDraft => {
        const currentPartsValue =
          typeof previousDraft.parts_replaced === 'string'
            ? previousDraft.parts_replaced
            : '';
        const uniqueParts = currentPartsValue
          .split(',')
          .map(value => value.trim())
          .filter(Boolean);

        if (!uniqueParts.includes(partName)) {
          uniqueParts.push(partName);
        }

        return {
          ...previousDraft,
          parts_replaced: uniqueParts.join(', '),
        };
      });

      if (dynamicFormRef.current) {
        const currentValues = dynamicFormRef.current.getFormData();
        const currentPartsValue =
          typeof currentValues.parts_replaced === 'string'
            ? currentValues.parts_replaced
            : '';
        const uniqueParts = currentPartsValue
          .split(',')
          .map(value => value.trim())
          .filter(Boolean);

        if (!uniqueParts.includes(partName)) {
          uniqueParts.push(partName);
        }

        dynamicFormRef.current.resetForm({
          ...currentValues,
          parts_replaced: uniqueParts.join(', '),
        });
      }

      return true;
    },
    [selectedTask]
  );

  // Handle barcode scan result without alert loop.
  useEffect(() => {
    if (scannedBarcode) {
      const part = parts.find(p => p.barcode === scannedBarcode.data);
      if (part) {
        const mappedToForm = appendScannedPartToForm(part.name);
        setScannedParts(previous => {
          if (previous.some(item => item.barcode === part.barcode)) {
            return previous;
          }
          return [...previous, part];
        });

        setScannerNotice({
          type: 'success',
          message: mappedToForm
            ? `Part found: ${part.name}. Added to report field "Parts Replaced".`
            : `Part found: ${part.name}. Select a task with "Parts Replaced" field to store it in form.`,
        });
      } else {
        setScannerNotice({
          type: 'error',
          message: `Part not found for barcode ${scannedBarcode.data}`,
        });
      }
    }
  }, [scannedBarcode, parts, appendScannedPartToForm]);

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
        id: createPhotoId(),
        uri: result.uri,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      // Return original if compression fails
      return {
        id: createPhotoId(),
        uri,
        width: 0,
        height: 0,
      };
    }
  };

  // Add photo to report - store locally, upload to storage only when saving report
  const addPhoto = (photo: Photo) => {
    setPhotos(previousPhotos => {
      if (previousPhotos.length >= 10) {
        Alert.alert('Limit Reached', 'Maximum 10 photos allowed');
        return previousPhotos;
      }
      return appendPhoto(previousPhotos, photo);
    });
  };

  // Remove photo
  const removePhoto = (id: string) => {
    setPhotos(previousPhotos => removePhotoById(previousPhotos, id));
  };

  // Open barcode scanner
  const openScanner = () => {
    if (dynamicFormRef.current) {
      setReportFormDraft(dynamicFormRef.current.getFormData());
    }

    setScannerNotice(null);
    resetScanner();
    setIsScannerOpen(true);
    startScanner();
  };

  // Close scanner
  const closeScanner = () => {
    setScannerNotice(null);
    setIsScannerOpen(false);
    stopScanner();
  };

  useEffect(() => {
    if (!scannerLifecycleRef.current) {
      scannerLifecycleRef.current = true;
      return;
    }

    if (!isScannerOpen) {
      resetScanner();
    }
  }, [isScannerOpen, resetScanner]);

  const resumeScanner = () => {
    setScannerNotice(null);
    resetScanner();
    startScanner();
  };

  // Handle signature - upload to storage immediately
  const handleSignature = async (signatureData: string) => {
    if (!selectedTask) {
      Alert.alert('Error', 'Please select a task first');
      return;
    }

    setIsProcessing(true);
    try {
      const previousSignature = signatureUrlRef.current;
      const signatureUrl = await uploadSignature(
        signatureData,
        currentReportId
      );
      if (previousSignature && previousSignature !== signatureUrl) {
        await cleanupUploadedSignature(previousSignature);
      }
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
      if (!result) {
        Alert.alert(
          'Detection Unavailable',
          'AI detection is not available right now. Check internet connection and Google Vision API key configuration.'
        );
        return;
      }

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
                setReportFormDraft(previousDraft => ({
                  ...previousDraft,
                  ...newValues,
                }));
              },
            },
            { text: 'No', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Detection Complete',
          'No useful field suggestions were found in this photo.'
        );
      }
    } catch (error) {
      console.error('Vision detection error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Could not process image for detection';
      Alert.alert('Detection Failed', message);
    } finally {
      setIsVisionProcessing(false);
    }
  };

  // Reset all form state
  const resetCreateReportState = async (options?: {
    preserveUploadedAssets?: boolean;
  }) => {
    const shouldPreserveUploadedAssets =
      options?.preserveUploadedAssets ?? false;
    const currentSignature = signatureUrlRef.current;

    if (!shouldPreserveUploadedAssets && currentSignature) {
      await cleanupUploadedSignature(currentSignature);
    }

    hasPersistedCurrentReportRef.current = false;
    signatureUrlRef.current = null;
    setPhotos([]);
    setSelectedTask(null);
    setSignature(null);
    setDetectionValues({});
    setReportFormDraft({});
    setScannedParts([]);
    setCurrentReportId(createReportId());
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
        const isFormValid = await dynamicFormRef.current.submitForm();
        if (!isFormValid) {
          requestAnimationFrame(() => {
            scrollViewRef.current?.scrollTo({
              y: Math.max(formSectionY - 16, 0),
              animated: true,
            });
          });
          return;
        }
      }

      const nowIso = new Date().toISOString();

      // Get form data from DynamicForm to ensure we have the latest values
      const formValues = dynamicFormRef.current?.getFormData() || {};

      // Prepare form data
      const reportFormData = {
        ...formValues,
        photosCount: photos.length.toString(),
        source: 'mobile-app',
        timestamp: nowIso,
      };
      const technicianName =
        user?.profile.name?.trim() || user?.email || 'Technician';
      const technicianId = user?.id || 'unknown-technician';

      const pdfUri = await generatePDF({
        id: currentReportId,
        taskTitle: selectedTask.title,
        taskDescription: selectedTask.description,
        taskAddress: selectedTask.address,
        customerName: selectedTask.customer_name,
        customerPhone: selectedTask.customer_phone,
        technicianName,
        technicianId,
        photos: photos.map(photo => photo.uri),
        formData: reportFormData,
        taskCategory: selectedTask.category,
        signature: signature,
        createdAt: nowIso,
        completedAt: nowIso,
      });

      // Upload photos to storage
      let photoUrls: string[] = [];
      try {
        photoUrls = await Promise.all(
          photos.map(photo => uploadPhoto(photo.uri, currentReportId))
        );
      } catch (uploadError) {
        console.error('Photo upload failed:', uploadError);
        Alert.alert(
          'Upload Failed',
          'Could not upload photos. Report will be saved locally and synced later.',
          [{ text: 'OK' }]
        );
        photoUrls = photos.map(p => p.uri);
      }

      // Upload PDF to storage
      let pdfUrl: string;
      try {
        pdfUrl = await uploadPDF(pdfUri, currentReportId);
      } catch (uploadError) {
        console.error('PDF upload failed:', uploadError);
        Alert.alert(
          'Upload Failed',
          'Could not upload PDF. Report will be saved locally and synced later.',
          [{ text: 'OK' }]
        );
        pdfUrl = pdfUri;
      }

      // Save report locally and enqueue sync (offline-first)
      await reportRepository.create({
        id: currentReportId,
        task_id: selectedTask.id,
        status: 'completed',
        photos: photoUrls,
        form_data: {
          ...reportFormData,
          pdf_url: pdfUrl,
        },
        signature: signature || null,
        pdf_url: pdfUrl,
      });
      hasPersistedCurrentReportRef.current = true;
      signatureUrlRef.current = null;

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
                void resetCreateReportState({
                  preserveUploadedAssets: true,
                });
                router.push('/reports');
              }
            },
          },
          {
            text: 'Done',
            onPress: () => {
              void resetCreateReportState({
                preserveUploadedAssets: true,
              });
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

  const handleFormSectionLayout = (event: LayoutChangeEvent) => {
    setFormSectionY(event.nativeEvent.layout.y);
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

  if (isScannerOpen) {
    return (
      <ReportScannerContent
        cameraRef={cameraRef}
        hasPermission={hasPermission}
        insetsBottom={insets.bottom}
        insetsTop={insets.top}
        isScannerOpen={isScannerOpen}
        isScanning={isScanning}
        onBarcodeScanned={handleBarCodeScanned}
        onClose={closeScanner}
        onOpenSettings={openSettings}
        onResumeScanner={resumeScanner}
        onRetryPermission={handleScannerPermissionRetry}
        scannerNotice={scannerNotice}
      />
    );
  }

  const formTemplate = getFormTemplate();
  const hasRequiredDataForSave =
    Boolean(selectedTask) && isRequiredFormValid && photos.length > 0;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      ref={scrollViewRef}
      testID="reports-create-screen"
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <TouchableOpacity
          className="p-2"
          onPress={() => router.push('/(tabs)/reports')}
          testID="reports-create-back-button"
        >
          <Ionicons color="#1e40af" name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">New Report</Text>
        <View className="w-6" />
      </View>

      {/* Task Selection */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">
          Select Task
        </Text>
        <TaskSelector
          onSelectTask={setSelectedTask}
          selectedTask={selectedTask}
        />
      </View>

      {/* Vision Detection (only if photos added) */}
      {photos.length > 0 && (
        <View className="mb-4 bg-white p-4">
          <Text className="mb-3 text-base font-semibold text-gray-800">
            AI Detection
          </Text>
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
                <Text className="ml-2 text-sm font-semibold text-white">
                  Detect Objects
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text className="mt-2 text-center text-xs text-gray-500">
            AI will analyze the first photo and suggest form field values
          </Text>
        </View>
      )}

      {/* Dynamic Form */}
      {formTemplate ? (
        <View className="mb-4 bg-white p-4" onLayout={handleFormSectionLayout}>
          <Text className="mb-3 text-base font-semibold text-gray-800">
            Report Details
          </Text>
          <DynamicForm
            ref={dynamicFormRef}
            defaultValues={{ ...detectionValues, ...reportFormDraft }}
            onValidationChange={setIsRequiredFormValid}
            template={formTemplate}
          />
        </View>
      ) : null}

      {/* Signature */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">
          Customer Signature
        </Text>
        <TouchableOpacity
          className={`flex-row items-center justify-center rounded-lg border border-dashed p-6 ${signature ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
          onPress={() => setIsSignatureOpen(true)}
          testID="reports-signature-button"
        >
          {signature ? (
            <>
              <Ionicons color="#10b981" name="checkmark-circle" size={24} />
              <Text className="ml-2 text-sm font-semibold text-blue-800">
                Signature Added
              </Text>
            </>
          ) : (
            <>
              <Ionicons color="#1e40af" name="pencil" size={24} />
              <Text className="ml-2 text-sm font-semibold text-blue-800">
                Add Customer Signature
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Photo Documentation */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">
          Photo Documentation
        </Text>
        <FileSystemErrorBoundary>
          <View className="flex-row flex-wrap gap-3">
            {photos.map(photo => (
              <View className="relative h-[100px] w-[100px]" key={photo.id}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: 100, height: 100, borderRadius: 8 }}
                />
                <TouchableOpacity
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500"
                  onPress={() => removePhoto(photo.id)}
                >
                  <Ionicons color="#ffffff" name="close" size={20} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              className="h-[100px] w-[100px] items-center justify-center rounded-lg border border-dashed border-gray-200"
              onPress={takePhoto}
              testID="reports-take-photo-button"
            >
              <Ionicons color="#1e40af" name="camera" size={32} />
              <Text className="mt-2 text-xs text-blue-800">Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="h-[100px] w-[100px] items-center justify-center rounded-lg border border-dashed border-gray-200"
              onPress={pickPhoto}
              testID="reports-gallery-button"
            >
              <Ionicons color="#1e40af" name="images" size={32} />
              <Text className="mt-2 text-xs text-blue-800">From Gallery</Text>
            </TouchableOpacity>
          </View>
        </FileSystemErrorBoundary>
      </View>

      {/* Scan Part Barcode */}
      <View className="mb-4 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-gray-800">
          Scan Part Barcode
        </Text>
        <TouchableOpacity
          className="flex-row items-center justify-center rounded-lg bg-blue-800 p-3"
          onPress={openScanner}
          testID="reports-scan-barcode-button"
        >
          <Ionicons color="#ffffff" name="barcode" size={24} />
          <Text className="ml-2 text-sm font-semibold text-white">
            Scan Part Barcode
          </Text>
        </TouchableOpacity>

        {scannedParts.length > 0 ? (
          <View className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <Text className="text-sm font-semibold text-emerald-800">
              Scanned parts in this report:
            </Text>
            <Text className="mt-1 text-xs text-emerald-700">
              These values are written to form field `parts_replaced`.
            </Text>
            {scannedParts.map(part => (
              <Text className="mt-1 text-sm text-emerald-900" key={part.id}>
                • {part.name} ({part.barcode})
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* Save Button */}
      <View className="p-4">
        {!hasRequiredDataForSave ? (
          <View className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <Text className="text-sm text-amber-900">
              Before saving, fill in all required fields and add at least one
              photo.
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          className={`flex-row items-center justify-center rounded-lg p-4 ${!hasRequiredDataForSave || isProcessing ? 'bg-gray-400' : 'bg-blue-800'}`}
          disabled={!hasRequiredDataForSave || isProcessing}
          onPress={handleSaveReport}
          testID="reports-save-button"
        >
          {isProcessing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons color="#ffffff" name="checkmark" size={20} />
              <Text className="ml-2 text-base font-semibold text-white">
                Save Report
              </Text>
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
