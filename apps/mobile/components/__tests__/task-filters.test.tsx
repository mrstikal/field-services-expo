import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TaskFilters from '../task-filters';

describe('TaskFilters', () => {
  const mockFilters = {
    status: null,
    priority: null,
    dateRange: null,
  };
  const onFilterChangeMock = vi.fn();
  const onApplyFiltersMock = vi.fn();
  const onResetFiltersMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when visible is true', () => {
    const { getByText } = render(
      <TaskFilters
        isVisible={true}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );
    expect(getByText('Filter Tasks')).toBeDefined();
  });

  it('should not render when visible is false', () => {
    const { queryByText } = render(
      <TaskFilters
        isVisible={false}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );
    expect(queryByText('Filter Tasks')).toBeNull();
  });

  it('should call onFilterChange with correct arguments for status filter', () => {
    const { getByText } = render(
      <TaskFilters
        isVisible={true}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );

    fireEvent.press(getByText('Assigned'));
    expect(onFilterChangeMock).toHaveBeenCalledWith('status', 'assigned');

    fireEvent.press(getByText('Completed'));
    expect(onFilterChangeMock).toHaveBeenCalledWith('status', 'completed');
  });

  it('should call onFilterChange with correct arguments for priority filter', () => {
    const { getByText } = render(
      <TaskFilters
        isVisible={true}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );

    fireEvent.press(getByText('High'));
    expect(onFilterChangeMock).toHaveBeenCalledWith('priority', 'high');

    fireEvent.press(getByText('Urgent'));
    expect(onFilterChangeMock).toHaveBeenCalledWith('priority', 'urgent');
  });

  it('should call onFilterChange with correct arguments for date range filter', () => {
    const { getByText } = render(
      <TaskFilters
        isVisible={true}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );

    fireEvent.press(getByText('Today'));
    expect(onFilterChangeMock).toHaveBeenCalledWith('dateRange', 'today');

    fireEvent.press(getByText('This Week'));
    expect(onFilterChangeMock).toHaveBeenCalledWith('dateRange', 'this_week');
  });

  it('should call onApplyFilters when Close button is pressed', () => {
    const { getByText } = render(
      <TaskFilters
        isVisible={true}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );

    fireEvent.press(getByText('Close'));
    expect(onApplyFiltersMock).toHaveBeenCalledTimes(1);
  });

  it('should call onResetFilters when Refresh icon is pressed', () => {
    const { getByLabelText } = render(
      <TaskFilters
        isVisible={true}
        filters={mockFilters}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );

    fireEvent.press(getByLabelText('refresh')); // Assuming Ionicons refresh has this accessibility label
    expect(onResetFiltersMock).toHaveBeenCalledTimes(1);
  });

  it('should apply active filter styling', () => {
    const { getByText, rerender } = render(
      <TaskFilters
        isVisible={true}
        filters={{ ...mockFilters, status: 'assigned' }}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );

    expect(getByText('Assigned').props.className).toContain('bg-blue-800');
    expect(getByText('All').props.className).toContain('bg-gray-100');

    rerender(
      <TaskFilters
        isVisible={true}
        filters={{ ...mockFilters, priority: 'urgent' }}
        onFilterChange={onFilterChangeMock}
        onApplyFilters={onApplyFiltersMock}
        onResetFilters={onResetFiltersMock}
      />
    );
    expect(getByText('Urgent').props.className).toContain('bg-blue-800');
  });
});
