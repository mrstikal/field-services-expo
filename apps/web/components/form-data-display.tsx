'use client';

import { Check, X } from 'lucide-react';
import { formTemplates } from './report-form-templates';
import { TaskCategory, FormFieldType } from '@field-service/shared-types';

interface FormDataDisplayProps {
  data: Record<string, any>;
  category?: TaskCategory;
}

export function FormDataDisplay({ data, category }: FormDataDisplayProps) {
  if (!data || typeof data !== 'object') {
    return <div className="text-gray-500 italic">No form data available</div>;
  }

  if (category && formTemplates[category]) {
    const template = formTemplates[category];
    return (
      <div className="space-y-4">
        {template.fields.map((field) => {
          const value = data[field.id];
          if (value === undefined || value === null) {
            return null;
          }

          let displayValue = String(value);

          switch (field.type) {
            case 'checkbox':
              displayValue = value ? 'Yes' : 'No';
              break;
            case 'select':
              const option = field.options?.find((o) => o.value === value);
              displayValue = option ? option.label : String(value);
              break;
            case 'number':
              displayValue = Number(value).toFixed(2);
              break;
            case 'text':
            default:
              displayValue = String(value);
          }

          return (
            <div key={field.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500 flex-1 pr-4">{field.label}</span>
              <span className="text-sm font-medium text-right text-gray-900">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback to generic display if no category
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        const label = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());

        if (value === null || value === undefined) {
          return (
            <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-sm text-gray-400">—</span>
            </div>
          );
        }

        if (typeof value === 'boolean') {
          return (
            <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0 items-center">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`flex items-center gap-1.5 ${value ? 'text-green-600' : 'text-red-500'}`}>
                {value ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                <span className="text-sm font-medium">{value ? 'Yes' : 'No'}</span>
              </div>
            </div>
          );
        }

        if (typeof value === 'object') {
          return (
            <div key={key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="font-medium text-sm text-gray-700 mb-3 border-b pb-2">{label}</div>
              <FormDataDisplay data={value} />
            </div>
          );
        }

        return (
          <div key={key} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-500 flex-1 pr-4">{label}</span>
            <span className="text-sm font-medium text-right text-gray-900 break-all">
              {String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
