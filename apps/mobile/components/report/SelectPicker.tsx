import React, { useState } from 'react';
import RNPickerSelect from 'react-native-picker-select';
import { FormField } from '@field-service/shared-types';

interface SelectPickerProps {
  field: FormField;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SelectPicker({ field, value, onChange, isOpen, onClose }: SelectPickerProps) {
  const [selectedValue, setSelectedValue] = useState<string | number | undefined>(value);

  const handleValueChange = (itemValue: string | number) => {
    setSelectedValue(itemValue);
    onChange(itemValue);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <RNPickerSelect
      onValueChange={handleValueChange}
      items={field.options?.map((option) => ({
        label: option.label,
        value: option.value,
        key: option.value,
      })) ?? []}
      placeholder={{ label: 'Select...', value: undefined, key: 'placeholder' }}
      value={selectedValue}
      style={{
        inputIOS: {
          fontSize: 16,
          paddingVertical: 12,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor: 'gray',
          borderRadius: 4,
          color: 'black',
          backgroundColor: 'white',
        },
        inputAndroid: {
          fontSize: 16,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: 'gray',
          borderRadius: 4,
          color: 'black',
          backgroundColor: 'white',
        },
      }}
    />
  );
}