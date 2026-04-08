import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SwipeableTaskCard from '../swipeable-task-card';
import { Task } from '@field-service/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
}));

// Mock @expo/vector-icons
vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => name,
}));

describe('SwipeableTaskCard', () => {
  const mockTask: Task = {
    id: 'task-1',
    title: 'Test Swipeable Task',
    description: 'Description',
    address: '123 Test Street',
    latitude: 0,
    longitude: 0,
    status: 'assigned',
    priority: 'high',
    category: 'repair',
    due_date: '2024-12-31',
    customer_name: 'John Doe',
    customer_phone: '555-1234',
    estimated_time: 60,
    technician_id: 'tech-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
    synced: 0,
  };

  const mockInvalidateQueries = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as never);
  });

  it('should render task title and address', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    expect(getByText('Test Swipeable Task')).toBeDefined();
    expect(getByText('123 Test Street')).toBeDefined();
  });

  it('should render priority badge', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    expect(getByText('high')).toBeDefined();
  });

  it('should render status label', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    expect(getByText('Assigned')).toBeDefined();
  });

  it('should render estimated time', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    expect(getByText('60 min')).toBeDefined();
  });

  it('should call onPress when card is tapped', () => {
    const onPressMock = vi.fn();
    const { getByLabelText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    fireEvent.press(
      getByLabelText(`Task: ${mockTask.title}, Priority: ${mockTask.priority}, Status: ${mockTask.status}`)
    );
    expect(onPressMock).toHaveBeenCalledWith(mockTask.id);
  });

  it('should show swipe action hints (Complete / Dismiss)', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    expect(getByText('Complete')).toBeDefined();
    expect(getByText('Dismiss')).toBeDefined();
  });

  it('should render in_progress status correctly', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard
        item={{ ...mockTask, status: 'in_progress' }}
        taskId={mockTask.id}
        onPress={onPressMock}
      />
    );

    expect(getByText('In Progress')).toBeDefined();
  });

  it('should render completed status correctly', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard
        item={{ ...mockTask, status: 'completed' }}
        taskId={mockTask.id}
        onPress={onPressMock}
      />
    );

    expect(getByText('Completed')).toBeDefined();
  });

  it('should call Haptics.notificationAsync with Success on complete swipe action', async () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    // Trigger the Complete action button directly
    fireEvent.press(getByText('Complete'));

    // Wait for async haptic call
    await vi.waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });
  });

  it('should call Haptics.notificationAsync with Error on dismiss swipe action', async () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    // Trigger the Dismiss action button directly
    fireEvent.press(getByText('Dismiss'));

    // Wait for async haptic call
    await vi.waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error
      );
    });
  });

  it('should invalidate tasks query after complete action', async () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <SwipeableTaskCard item={mockTask} taskId={mockTask.id} onPress={onPressMock} />
    );

    fireEvent.press(getByText('Complete'));

    await vi.waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['tasks'] })
      );
    });
  });
});
