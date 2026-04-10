import { TaskCategory, FormFieldType } from '@field-service/shared-types';

/**
 * Form templates with field definitions for each task category
 */
export const formTemplates: Record<
  TaskCategory,
  {
    name: string;
    fields: Array<{
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
    }>;
  }
> = {
  repair: {
    name: 'Repair Report',
    fields: [
      {
        id: 'fault_type',
        label: 'Type of Fault',
        type: 'select',
        options: [
          { label: 'Electrical', value: 'electrical' },
          { label: 'Mechanical', value: 'mechanical' },
          { label: 'Software', value: 'software' },
          { label: 'Other', value: 'other' },
        ],
        required: true,
      },
      {
        id: 'fault_description',
        label: 'Fault Description',
        type: 'text',
        required: true,
        minLength: 10,
        maxLength: 500,
      },
      {
        id: 'voltage',
        label: 'Voltage (V)',
        type: 'number',
        min: 0,
        max: 1000,
      },
      { id: 'current', label: 'Current (A)', type: 'number', min: 0, max: 100 },
      {
        id: 'parts_replaced',
        label: 'Parts Replaced',
        type: 'text',
        placeholder: 'e.g., Circuit breaker 16A',
      },
      {
        id: 'repair_time',
        label: 'Repair Time (hours)',
        type: 'number',
        min: 0,
        max: 24,
      },
      {
        id: 'test_results',
        label: 'Test Results',
        type: 'select',
        options: [
          { label: 'Passed', value: 'passed' },
          { label: 'Failed', value: 'failed' },
          { label: 'N/A', value: 'na' },
        ],
        required: true,
      },
      {
        id: 'additional_notes',
        label: 'Additional Notes',
        type: 'text',
        placeholder: 'Any additional information...',
        maxLength: 1000,
      },
    ],
  },
  installation: {
    name: 'Installation Report',
    fields: [
      {
        id: 'installation_type',
        label: 'Installation Type',
        type: 'select',
        options: [
          { label: 'New Installation', value: 'new' },
          { label: 'Upgrade', value: 'upgrade' },
          { label: 'Extension', value: 'extension' },
        ],
        required: true,
      },
      {
        id: 'equipment_installed',
        label: 'Equipment Installed',
        type: 'text',
        required: true,
        minLength: 5,
        maxLength: 500,
      },
      {
        id: 'cable_type',
        label: 'Cable Type',
        type: 'text',
        placeholder: 'e.g., 2.5mm² TW',
      },
      {
        id: 'cable_length',
        label: 'Cable Length (m)',
        type: 'number',
        min: 0,
        max: 10000,
      },
      {
        id: 'number_of_outlets',
        label: 'Number of Outlets',
        type: 'number',
        min: 0,
        max: 1000,
      },
      {
        id: 'number_of_switches',
        label: 'Number of Switches',
        type: 'number',
        min: 0,
        max: 1000,
      },
      {
        id: 'installation_test_passed',
        label: 'Installation Test Passed',
        type: 'checkbox',
      },
      {
        id: 'compliance_notes',
        label: 'Compliance Notes',
        type: 'text',
        placeholder: 'Code compliance information...',
        maxLength: 500,
      },
    ],
  },
  maintenance: {
    name: 'Maintenance Report',
    fields: [
      {
        id: 'maintenance_type',
        label: 'Maintenance Type',
        type: 'select',
        options: [
          { label: 'Preventive', value: 'preventive' },
          { label: 'Corrective', value: 'corrective' },
          { label: 'Emergency', value: 'emergency' },
        ],
        required: true,
      },
      {
        id: 'maintenance_items',
        label: 'Maintenance Items',
        type: 'text',
        required: true,
        minLength: 5,
        maxLength: 1000,
      },
      {
        id: 'issues_found',
        label: 'Issues Found',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Minor', value: 'minor' },
          { label: 'Major', value: 'major' },
        ],
        required: true,
      },
      {
        id: 'actions_taken',
        label: 'Actions Taken',
        type: 'text',
        placeholder: 'Describe actions performed...',
        maxLength: 500,
      },
      {
        id: 'recommended_actions',
        label: 'Recommended Actions',
        type: 'text',
        placeholder: 'Future recommendations...',
        maxLength: 500,
      },
      {
        id: 'next_maintenance_date',
        label: 'Next Maintenance Date',
        type: 'text',
        placeholder: 'YYYY-MM-DD',
      },
      {
        id: 'maintenance_time',
        label: 'Maintenance Time (hours)',
        type: 'number',
        min: 0,
        max: 24,
      },
    ],
  },
  inspection: {
    name: 'Inspection Report',
    fields: [
      {
        id: 'inspection_type',
        label: 'Inspection Type',
        type: 'select',
        options: [
          { label: 'Safety Inspection', value: 'safety' },
          { label: 'Code Compliance', value: 'code' },
          { label: 'Pre-commissioning', value: 'precommissioning' },
          { label: 'Periodic', value: 'periodic' },
        ],
        required: true,
      },
      {
        id: 'inspection_areas',
        label: 'Inspection Areas',
        type: 'text',
        required: true,
        minLength: 5,
        maxLength: 500,
      },
      {
        id: 'compliance_status',
        label: 'Compliance Status',
        type: 'select',
        options: [
          { label: 'Compliant', value: 'compliant' },
          { label: 'Non-compliant', value: 'noncompliant' },
          { label: 'Conditional', value: 'conditional' },
        ],
        required: true,
      },
      {
        id: 'deficiencies',
        label: 'Deficiencies',
        type: 'text',
        placeholder: 'List any deficiencies...',
        maxLength: 1000,
      },
      {
        id: 'corrective_actions',
        label: 'Corrective Actions Required',
        type: 'text',
        placeholder: 'Describe corrective actions...',
        maxLength: 500,
      },
      { id: 'inspection_passed', label: 'Inspection Passed', type: 'checkbox' },
      {
        id: 'inspector_comments',
        label: 'Inspector Comments',
        type: 'text',
        placeholder: 'Additional comments...',
        maxLength: 1000,
      },
    ],
  },
};
