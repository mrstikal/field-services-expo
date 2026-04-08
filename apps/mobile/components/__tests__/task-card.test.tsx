import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TaskCard from '../task-card';
import { Task } from '@field-service/shared-types';

describe('TaskCard', () => {
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Description of test task',
    address: '123 Main St, Anytown',
    latitude: 0,
    longitude: 0,
    status: 'assigned',
    priority: 'high',
    category: 'repair',
    due_date: '2024-12-31',
    customer_name: 'John Doe',
    customer_phone: '555-1234',
    estimated_time: 60,
    technician_id: 'tech1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
    synced: 0,
  };

  it('should render task card with correct data', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(<TaskCard item={mockTask} onPress={onPressMock} />);

    expect(getByText('Test Task')).toBeDefined();
    expect(getByText('123 Main St, Anytown')).toBeDefined();
    expect(getByText('high')).toBeDefined();
    expect(getByText('Assigned')).toBeDefined();
    expect(getByText('60 min')).toBeDefined();
  });

  it('should call onPress when card is pressed', () => {
    const onPressMock = vi.fn();
    const { getByLabelText } = render(<TaskCard item={mockTask} onPress={onPressMock} />);

    fireEvent.press(getByLabelText(`Task: ${mockTask.title}, Priority: ${mockTask.priority}, Status: ${mockTask.status}`));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should display correct priority styling', () => {
    const onPressMock = vi.fn();
    const { getByText, rerender } = render(<TaskCard item={mockTask} onPress={onPressMock} />);

    // Test 'high' priority
    expect(getByText('high').parent?.props.className).toContain('bg-orange-500');

    // Test 'urgent' priority
    rerender(<TaskCard item={{ ...mockTask, priority: 'urgent' }} onPress={onPressMock} />);
    expect(getByText('urgent').parent?.props.className).toContain('bg-red-600');

    // Test 'low' priority
    rerender(<TaskCard item={{ ...mockTask, priority: 'low' }} onPress={onPressMock} />);
    expect(getByText('low').parent?.props.className).toContain('bg-green-500');
  });

  it('should display correct status label', () => {
    const onPressMock = vi.fn();
    const { getByText, rerender } = render(<TaskCard item={mockTask} onPress={onPressMock} />);

    // Test 'assigned' status
    expect(getByText('Assigned')).toBeDefined();

    // Test 'in_progress' status
    rerender(<TaskCard item={{ ...mockTask, status: 'in_progress' }} onPress={onPressMock} />);
    expect(getByText('In Progress')).toBeDefined();

    // Test 'completed' status
    rerender(<TaskCard item={{ ...mockTask, status: 'completed' }} onPress={onPressMock} />);
    expect(getByText('Completed')).toBeDefined();
  });
});
