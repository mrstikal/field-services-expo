import React, { useMemo } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormTemplate } from '@field-service/shared-types';
import { createReportSchema, ReportFormValues } from '@/lib/validators/report-schemas';
import { FormField as FormFieldComponent } from './FormField';

interface DynamicFormProps {
  readonly template: FormTemplate;
  readonly onSubmit: (data: ReportFormValues) => void;
  readonly isLoading?: boolean;
}

export function DynamicForm({ template, onSubmit, isLoading = false }: DynamicFormProps) {
  const schema = useMemo(() => createReportSchema(template.categoryId), [template.categoryId]);
  
  const methods = useForm<ReportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const { control, handleSubmit } = methods;

  // Filter fields based on conditional logic
  const visibleFields = useMemo(() => {
    const formData = methods.getValues();
    return template.fields.filter(field => {
      if (!field.conditional) return true;
      const fieldValue = formData[field.conditional.fieldId];
      return fieldValue === field.conditional?.value;
    });
  }, [template.fields, methods]);

  const onSubmitHandler = (data: ReportFormValues) => {
    try {
      onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
      Alert.alert('Error', 'Failed to submit form');
    }
  };

  return (
    <FormProvider {...methods}>
      <ScrollView className="flex-1 bg-slate-50">
        <View className="p-4">
          {visibleFields.map((field) => (
            <FormFieldComponent
              control={control}
              field={field}
              key={field.id}
            />
          ))}
        </View>
        <View className="p-4">
          <TouchableOpacity className="items-center rounded-lg bg-blue-800 p-4" onPress={handleSubmit(onSubmitHandler)}>
            <Text className="text-base font-semibold text-white">
              {isLoading ? 'Saving...' : 'Save Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormProvider>
  );
}