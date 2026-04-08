import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  DynamicForm,
  DynamicFormHandle,
} from '@/components/report/DynamicForm';
import { FormTemplate, TaskCategory } from '@field-service/shared-types';
import {
  createReportSchema,
  ReportFormValues,
} from '@/lib/validators/report-schemas';
import { FormField as FormFieldComponent } from '@/components/report/FormField';
import { Alert } from 'react-native';

// Mock the FormFieldComponent to simplify testing DynamicForm's logic
vi.mock('@/components/report/FormField', () => ({
  FormField: vi.fn(({ control, field }) => (
    <input
      data-testid={`form-field-${field.id}`}
      value={control._fields[field.id]?._f.value || ''}
      onChange={e => {
        control._fields[field.id]?._f.onChange({
          target: { value: e.target.value },
        });
      }}
    />
  )),
}));

// Mock createReportSchema to return a simple Zod schema for testing
vi.mock('@/lib/validators/report-schemas', () => ({
  createReportSchema: vi.fn((categoryId: TaskCategory) => {
    // Return a simple schema for testing purposes
    return {
      parse: vi.fn(data => {
        if (data.requiredField === 'error') {
          throw new Error('Validation failed');
        }
        return data;
      }),
    };
  }),
  ReportFormValues: vi.fn(), // Mock the type if needed
}));

describe('DynamicForm', () => {
  const mockTemplate: FormTemplate = {
    id: 'template1',
    categoryId: 'repair',
    name: 'Repair Report',
    fields: [
      {
        id: 'field1',
        label: 'Field 1',
        type: 'text',
        required: true,
      },
      {
        id: 'field2',
        label: 'Field 2',
        type: 'number',
        conditional: { fieldId: 'field1', value: 'show' },
      },
      {
        id: 'requiredField',
        label: 'Required Field',
        type: 'text',
        required: true,
      },
    ],
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
  };

  const onSubmitMock = vi.fn();
  const alertSpy = vi.spyOn(Alert, 'alert');

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy.mockImplementation(() => {}); // Suppress Alert during tests
  });

  it('should render all fields defined in the template', () => {
    const { getByTestId } = render(
      <DynamicForm template={mockTemplate} onSubmit={onSubmitMock} />
    );

    expect(getByTestId('form-field-field1')).toBeDefined();
    expect(getByTestId('form-field-field2')).toBeDefined();
    expect(getByTestId('form-field-requiredField')).toBeDefined();
  });

  it('should show/hide fields based on conditional logic', () => {
    const { getByTestId, queryByTestId } = render(
      <DynamicForm template={mockTemplate} onSubmit={onSubmitMock} />
    );

    // Initially, field2 should be hidden
    expect(queryByTestId('form-field-field2')).toBeNull();

    // Change field1 value to 'show' to make field2 visible
    fireEvent(getByTestId('form-field-field1'), 'change', {
      target: { value: 'show' },
    });

    // Now field2 should be visible
    expect(getByTestId('form-field-field2')).toBeDefined();
  });

  it('should call onSubmit with form data on successful submission', async () => {
    const formRef = React.createRef<DynamicFormHandle>();
    const { getByTestId } = render(
      <DynamicForm
        ref={formRef}
        template={mockTemplate}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent(getByTestId('form-field-field1'), 'change', {
      target: { value: 'test value' },
    });
    fireEvent(getByTestId('form-field-requiredField'), 'change', {
      target: { value: 'some data' },
    });

    await formRef.current?.submitForm();

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          field1: 'test value',
          requiredField: 'some data',
        })
      );
    });
  });

  it('should show alert on validation failure', async () => {
    const formRef = React.createRef<DynamicFormHandle>();
    const { getByTestId } = render(
      <DynamicForm
        ref={formRef}
        template={mockTemplate}
        onSubmit={onSubmitMock}
      />
    );

    // Intentionally set a value that will cause validation to fail based on our mock schema
    fireEvent(getByTestId('form-field-requiredField'), 'change', {
      target: { value: 'error' },
    });

    await formRef.current?.submitForm();

    await waitFor(() => {
      expect(onSubmitMock).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to submit form');
    });
  });

  it('should return form data using getFormData', () => {
    const formRef = React.createRef<DynamicFormHandle>();
    const { getByTestId } = render(
      <DynamicForm
        ref={formRef}
        template={mockTemplate}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent(getByTestId('form-field-field1'), 'change', {
      target: { value: 'data for get' },
    });
    fireEvent(getByTestId('form-field-requiredField'), 'change', {
      target: { value: 'more data' },
    });

    const formData = formRef.current?.getFormData();
    expect(formData).toEqual(
      expect.objectContaining({
        field1: 'data for get',
        requiredField: 'more data',
      })
    );
  });

  it('should reset form data using resetForm', () => {
    const formRef = React.createRef<DynamicFormHandle>();
    const { getByTestId } = render(
      <DynamicForm
        ref={formRef}
        template={mockTemplate}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent(getByTestId('form-field-field1'), 'change', {
      target: { value: 'initial value' },
    });
    expect(formRef.current?.getFormData().field1).toBe('initial value');

    formRef.current?.resetForm();
    expect(formRef.current?.getFormData().field1).toBeUndefined();

    formRef.current?.resetForm({ field1: 'new default' });
    expect(formRef.current?.getFormData().field1).toBe('new default');
  });
});
