import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { Controller, Control } from 'react-hook-form';
import { FormField as FormFieldType } from '@field-service/shared-types';
import RNPickerSelect from 'react-native-picker-select';

interface FormFieldProps {
  readonly field: FormFieldType;
  readonly control: Control<Record<string, unknown>>;
}

export function FormField({ field, control }: FormFieldProps) {
  const renderLabel = () => (
    <View className="mb-2 flex-row items-center">
      <Text className="text-sm font-semibold text-gray-800">{field.label}</Text>
      {field.required ? (
        <Text className="ml-1 text-sm font-semibold text-red-500">*</Text>
      ) : null}
    </View>
  );

  const renderInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <Controller
            control={control}
            name={field.id}
            render={({
              field: fieldProps,
              fieldState: { error: fieldError },
            }) => (
              <View className="rounded-lg border border-gray-200 bg-white">
                <TextInput
                  className={`min-h-11 px-3 py-3 text-sm text-gray-800 ${fieldError ? 'border border-red-500' : ''}`}
                  multiline
                  numberOfLines={4}
                  onChangeText={fieldProps.onChange}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9ca3af"
                  testID={`report-field-${field.id}`}
                  value={fieldProps.value as string}
                />
                {fieldError ? (
                  <Text className="ml-3 mt-1 text-xs text-red-500">
                    {fieldError.message}
                  </Text>
                ) : null}
              </View>
            )}
          />
        );

      case 'number':
        return (
          <Controller
            control={control}
            name={field.id}
            render={({
              field: fieldProps,
              fieldState: { error: fieldError },
            }) => (
              <View className="rounded-lg border border-gray-200 bg-white">
                <TextInput
                  className={`min-h-11 px-3 py-3 text-sm text-gray-800 ${fieldError ? 'border border-red-500' : ''}`}
                  keyboardType="decimal-pad"
                  onChangeText={text =>
                    fieldProps.onChange(text ? parseFloat(text) : null)
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor="#9ca3af"
                  testID={`report-field-${field.id}`}
                  value={fieldProps.value as string}
                />
                {fieldError ? (
                  <Text className="ml-3 mt-1 text-xs text-red-500">
                    {fieldError.message}
                  </Text>
                ) : null}
              </View>
            )}
          />
        );

      case 'checkbox':
        return (
          <Controller
            control={control}
            name={field.id}
            render={({ field: fieldProps }) => (
              <View className="flex-row items-center justify-between p-3">
                <View className="flex-row items-center">
                  <Text className="text-sm text-gray-800">{field.label}</Text>
                  {field.required ? (
                    <Text className="ml-1 text-sm font-semibold text-red-500">
                      *
                    </Text>
                  ) : null}
                </View>
                <Switch
                  onValueChange={fieldProps.onChange}
                  testID={`report-field-${field.id}`}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : '#f4f3f4'}
                  trackColor={{ false: '#d1d5db', true: '#1e40af' }}
                  value={fieldProps.value as boolean}
                />
              </View>
            )}
          />
        );

      case 'select':
        return (
          <Controller
            control={control}
            name={field.id}
            render={({
              field: fieldProps,
              fieldState: { error: fieldError },
            }) => (
              <View>
                <RNPickerSelect
                  onValueChange={fieldProps.onChange}
                  items={
                    field.options?.map(option => ({
                      label: option.label,
                      value: option.value,
                      key: option.value,
                    })) ?? []
                  }
                  placeholder={{
                    label: 'Select...',
                    value: undefined,
                    key: 'placeholder',
                  }}
                  pickerProps={{
                    testID: `report-field-${field.id}-input`,
                  }}
                  textInputProps={{
                    testID: `report-field-${field.id}-input`,
                  }}
                  touchableWrapperProps={{
                    testID: `report-field-${field.id}`,
                  }}
                  value={fieldProps.value as string | number | undefined}
                  useNativeAndroidPickerStyle={false}
                  Icon={() => (
                    <View className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <Text className="text-sm text-gray-400">▼</Text>
                    </View>
                  )}
                  style={{
                    iconContainer: {
                      height: 0,
                      width: 0,
                    },
                    inputIOS: {
                      fontSize: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      paddingRight: 30,
                      borderWidth: 1,
                      borderColor: fieldError ? '#ef4444' : '#e5e7eb',
                      borderRadius: 8,
                      color: '#1f2937',
                      backgroundColor: '#ffffff',
                    },
                    inputAndroid: {
                      fontSize: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      paddingRight: 30,
                      borderWidth: 1,
                      borderColor: fieldError ? '#ef4444' : '#e5e7eb',
                      borderRadius: 8,
                      color: '#1f2937',
                      backgroundColor: '#ffffff',
                    },
                  }}
                />
                {fieldError ? (
                  <Text className="ml-3 mt-1 text-xs text-red-500">
                    {fieldError.message}
                  </Text>
                ) : null}
              </View>
            )}
          />
        );

      case 'signature':
        return (
          <View className="rounded-lg border border-gray-200 bg-white">
            <Text className="mb-2 text-sm font-semibold text-gray-800">
              {field.label}
            </Text>
            <TouchableOpacity
              className="min-h-[100px] items-center rounded-lg bg-gray-100 p-4"
              onPress={() => {}} // Will be implemented in signature component
            >
              <Text className="text-sm font-semibold text-blue-800">
                Sign Here
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View className="mb-4">
      {field.type !== 'checkbox' ? renderLabel() : null}
      {renderInput()}
    </View>
  );
}
