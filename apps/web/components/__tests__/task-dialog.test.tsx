import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskDialog from '@components/task-dialog';
import { Task } from '@field-service/shared-types';

// Mock TaskForm component
vi.mock('@components/task-form', () => ({
  __esModule: true,
  default: vi.fn(({ onSubmit, onCancel, task, loading }: any) => (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit(
          task ||
            {
              /* mock data */
            }
        );
      }}
    >
      <input
        data-testid="task-form-title"
        value={task?.title || ''}
        onChange={() => {}}
      />
      <button type="submit" disabled={loading}>
        Submit
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )),
}));

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: vi.fn(({ children, open, onOpenChange }: any) => (
    <div
      data-testid="dialog"
      data-open={open}
      onClick={() => onOpenChange(false)}
    >
      {open ? children : null}
    </div>
  )),
  DialogContent: vi.fn(({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  )),
  DialogHeader: vi.fn(({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  )),
  DialogTitle: vi.fn(({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  )),
  DialogFooter: vi.fn(({ children }: any) => (
    <div data-testid="dialog-footer">{children}</div>
  )),
}));

vi.mock('@/components/ui/button', () => ({
  Button: vi.fn(({ children, onClick, disabled, variant }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  )),
}));

describe('TaskDialog', () => {
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Description',
    address: 'Address',
    latitude: 0,
    longitude: 0,
    status: 'assigned',
    priority: 'low',
    category: 'repair',
    due_date: '2024-01-01',
    customer_name: 'Customer',
    customer_phone: '123',
    estimated_time: 60,
    technician_id: 'tech1',
    created_at: '',
    updated_at: '',
    version: 1,
    synced: 0,
  };

  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open is true', () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('dialog-title')).toHaveTextContent(
      'Create New Task'
    );
  });

  it('should not render when open is false', () => {
    render(
      <TaskDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false');
    expect(screen.queryByTestId('dialog-title')).toBeNull();
  });

  it('should display "Edit Task" title when task is provided', () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        task={mockTask}
      />
    );
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Edit Task');
    expect(screen.getByTestId('task-form-title')).toHaveValue(mockTask.title);
  });

  it('should call onCancel when dialog is closed via onOpenChange(false)', () => {
    const { getByTestId } = render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.click(getByTestId('dialog')); // Simulate clicking outside to close
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it('should call onSubmit when TaskForm submits', async () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        task={mockTask}
      />
    );
    fireEvent.submit(screen.getByText('Submit'));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith(mockTask);
    });
  });

  it('should disable buttons when loading is true', () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        loading={true}
      />
    );
    expect(screen.getByText('Submit')).toBeDisabled();
    expect(screen.getAllByText('Cancel').at(-1)).toBeDisabled();
  });
});
