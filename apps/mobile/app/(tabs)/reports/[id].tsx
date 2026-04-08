import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { formTemplates } from '@/lib/validators/report-schemas';
import { TaskCategory, FormFieldType } from '@field-service/shared-types';
import { useState } from 'react';

interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  conditional?: { fieldId: string; value: string | number | boolean };
}

interface Report {
  id: string;
  task_id: string;
  status: 'draft' | 'completed' | 'synced';
  photos: string[];
  form_data: Record<string, unknown>;
  signature: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  address: string;
  category: TaskCategory;
  customer_name: string;
  customer_phone: string;
  status: string;
  due_date: string;
}

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Fetch report data
  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Report;
    },
    enabled: id !== undefined,
  });

  // Fetch task data
  const {
    data: task,
    isLoading: taskLoading,
    error: taskError,
  } = useQuery({
    queryKey: ['task', report?.task_id],
    queryFn: async () => {
      if (!report?.task_id) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', report.task_id)
        .single();
      if (error) throw error;
      return data as Task;
    },
    enabled: report?.task_id !== undefined,
  });

  const getFieldValue = (
    field: FormField,
    formData: Record<string, unknown>
  ): string => {
    const value = formData[field.id];
    if (value === undefined || value === null) return 'N/A';

    switch (field.type) {
      case 'checkbox':
        return value ? 'Yes' : 'No';
      case 'select': {
        const option = field.options?.find(
          (o: { value: string | number }) => o.value === value
        );
        return option ? option.label : String(value);
      }
      default:
        return String(value);
    }
  };

  const formatFormData = (
    formData: Record<string, unknown>,
    category: TaskCategory
  ) => {
    const template = formTemplates[category];
    return template.fields.map(field => {
      const value = getFieldValue(field, formData);
      return { label: field.label, value };
    });
  };

  if (reportLoading || taskLoading) {
    return (
      <View className="flex-1 bg-slate-50">
        <View
          className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
          style={{ paddingTop: insets.top + 12 }}
        >
          <TouchableOpacity
            className="p-2"
            onPress={() => router.push('/(tabs)/reports')}
          >
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            Report Detail
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text>Loading report...</Text>
        </View>
      </View>
    );
  }

  if (reportError || taskError || !report || !task) {
    return (
      <View className="flex-1 bg-slate-50">
        <View
          className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
          style={{ paddingTop: insets.top + 12 }}
        >
          <TouchableOpacity
            className="p-2"
            onPress={() => router.push('/(tabs)/reports')}
          >
            <Ionicons color="#1e40af" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            Report Detail
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Ionicons color="#ef4444" name="alert-circle-outline" size={48} />
          <Text className="mt-3 text-base text-red-500">
            Failed to load report.
          </Text>
        </View>
      </View>
    );
  }

  const formData = formatFormData(report.form_data, task.category);

  return (
    <View className="flex-1 bg-slate-50">
      <View
        className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <TouchableOpacity
          className="p-2"
          onPress={() => router.push('/(tabs)/reports')}
        >
          <Ionicons color="#1e40af" name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">
          Report Detail
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Report Header */}
        <Text className="mb-3 text-xl font-semibold text-gray-800">
          Report #{report.id.slice(0, 8)}
        </Text>

        {/* Task Information */}
        <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold uppercase text-gray-500">
            Task Information
          </Text>
          <View className="mb-2">
            <Text className="text-xs text-gray-500">Task Title</Text>
            <Text className="text-sm font-medium text-gray-800">
              {task.title}
            </Text>
          </View>
          <View className="mb-2">
            <Text className="text-xs text-gray-500">Category</Text>
            <Text className="text-sm font-medium text-gray-800 capitalize">
              {task.category}
            </Text>
          </View>
          <View className="mb-2">
            <Text className="text-xs text-gray-500">Customer</Text>
            <Text className="text-sm font-medium text-gray-800">
              {task.customer_name}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-gray-500">Phone</Text>
            <Text className="text-sm font-medium text-gray-800">
              {task.customer_phone}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
          <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
            Status
          </Text>
          <Text className="text-sm font-medium text-gray-800 capitalize">
            {report.status}
          </Text>
        </View>

        {/* Form Data */}
        {formData.length > 0 && (
          <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold uppercase text-gray-500">
              Report Details
            </Text>
            {formData.map((item, index) => (
              <View key={index} className="mb-3">
                <Text className="text-xs text-gray-500">{item.label}</Text>
                <Text className="text-sm font-medium text-gray-800">
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Photos */}
        {report.photos && report.photos.length > 0 && (
          <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold uppercase text-gray-500">
              Photo Documentation
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {report.photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  className="h-[80px] w-[80px] overflow-hidden rounded-lg border border-gray-200"
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image
                    source={{ uri: photo }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Signature */}
        {report.signature && (
          <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold uppercase text-gray-500">
              Customer Signature
            </Text>
            <View className="h-[150px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <Image
                source={{
                  uri: report.signature.startsWith('http')
                    ? report.signature
                    : `data:image/png;base64,${report.signature}`,
                }}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* Timestamps */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-lg border border-gray-200 bg-white p-3">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Created at
            </Text>
            <Text className="text-sm font-medium text-gray-800">
              {new Date(report.created_at).toLocaleString()}
            </Text>
          </View>
          <View className="flex-1 rounded-lg border border-gray-200 bg-white p-3">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Updated at
            </Text>
            <Text className="text-sm font-medium text-gray-800">
              {new Date(report.updated_at).toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View className="flex-1 bg-black/90 p-4">
          <TouchableOpacity
            className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-3"
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons color="white" name="close" size={32} />
          </TouchableOpacity>
          <View className="flex-1 items-center justify-center">
            <Image
              source={{ uri: selectedPhoto || '' }}
              className="h-full w-full"
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
