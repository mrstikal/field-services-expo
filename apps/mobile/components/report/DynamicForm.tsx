import React, { useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, Alert } from 'react-native';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormTemplate } from '@field-service/shared-types';
import {
  createReportSchema,
  ReportFormValues,
} from '@/lib/validators/report-schemas';
import { FormField as FormFieldComponent } from './FormField';

export interface DynamicFormHandle {
  submitForm: () => Promise<boolean>;
  getFormData: () => Record<string, unknown>;
  resetForm: (values?: Record<string, unknown>) => void;
}

interface DynamicFormProps {
  readonly template: FormTemplate;
  readonly onSubmit?: (data: ReportFormValues) => void;
  readonly defaultValues?: Record<string, unknown>;
}

export const DynamicForm = forwardRef<DynamicFormHandle, DynamicFormProps>(
  ({ template, onSubmit, defaultValues }, ref) => {
    const schema = useMemo(
      () => createReportSchema(template.categoryId),
      [template.categoryId]
    );

    const methods = useForm<ReportFormValues>({
      resolver: zodResolver(schema),
      defaultValues: defaultValues || {},
    });

    const onSubmitHandler = (data: ReportFormValues) => {
      try {
        if (onSubmit) {
          onSubmit(data);
        }
      } catch (error) {
        console.error('Form submission error:', error);
        Alert.alert('Error', 'Failed to submit form');
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        submitForm: async () => {
          try {
            const isValid = await methods.trigger(undefined, {
              shouldFocus: true,
            });
            if (!isValid) {
              const firstErrorFieldId = Object.keys(
                methods.formState.errors
              )[0];
              if (firstErrorFieldId) {
                methods.setFocus(firstErrorFieldId as keyof ReportFormValues);
              }
              return false;
            }

            await methods.handleSubmit(onSubmitHandler)();
            return true;
          } catch {
            return false;
          }
        },
        getFormData: () => methods.getValues(),
        resetForm: (values?: Record<string, unknown>) => {
          methods.reset(values ?? {});
        },
      }),
      [methods, onSubmitHandler, methods.reset]
    );

    const { control } = methods;

    // Filter fields based on conditional logic
    const visibleFields = useMemo(() => {
      const formData = methods.getValues();
      return template.fields.filter(field => {
        if (field.type === 'photo') return false; // Exclude photo fields
        if (!field.conditional) return true;
        const fieldValue = formData[field.conditional.fieldId];
        return fieldValue === field.conditional?.value;
      });
    }, [template.fields, methods]);

    return (
      <FormProvider {...methods}>
        <View className="p-4">
          {visibleFields.map(field => (
            <FormFieldComponent
              control={control}
              field={field}
              key={field.id}
            />
          ))}
        </View>
      </FormProvider>
    );
  }
);

DynamicForm.displayName = 'DynamicForm';
