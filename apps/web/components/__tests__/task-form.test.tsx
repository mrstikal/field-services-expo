import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskForm from '../task-form';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Task } from '@field-service/shared-types';

// Mock react-hook-form
vi.mock('react-hook-form', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useForm: vi.fn(),
    useWatch: vi.fn(),
  };
});

// Mock zodResolver
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: vi.fn(() => vi.fn((values: any) => {
    // Simple mock resolver for testing
    const schema = z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().min(1, 'Description is required'),
      address: z.string().min(1, 'Address is required'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      status: z.enum(['assigned', 'in_progress', 'completed'] as const),
      priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
      category: z.enum(['repair', 'installation', 'maintenance', 'inspection'] as const),
      due_date: z.string().min(1, 'Due date is required'),
      customer_name: z.string().min(1, 'Customer name is required'),
      customer_phone: z.string().min(1, 'Customer phone is required'),
      estimated_time: z.number().min(1, 'Estimated time must be greater than 0'),
      technician_id: z.string().optional(),
    });
    try {
      schema.parse(values);
      return { values, errors: {} };
    } catch (error: any) {
      return { values: {}, errors: error.formErrors.fieldErrors };
    }
  })),
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
        })),
      })),
    })),
  },
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: vi.fn(({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  )),
}));
vi.mock('@/components/ui/input', () => ({
  Input: vi.fn((props: any) => <input {...props} />),
}));
vi.mock('@/components/ui/textarea', () => ({
  Textarea: vi.fn((props: any) => <textarea {...props} />),
}));
vi.mock('@/components/ui/select', () => ({
  Select: vi.fn(({ children, onValueChange, value }: any) => (
    <select data-testid="mock-select" onChange={(e: any) => onValueChange?.(e.target.value)} value={value ?? ''}>
      {children}
    </select>
  )),
  SelectContent: vi.fn(({ children }: any) => <>{children}</>),
  SelectItem: vi.fn(({ children, value }: any) => <option value={value}>{children}</option>),
  SelectTrigger: vi.fn(() => null),
  SelectValue: vi.fn(() => null),
}));
vi.mock('@/components/ui/label', () => ({
  Label: vi.fn(({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>),
}));
vi.mock('@/components/ui/card', () => ({
  Card: vi.fn(({ children }: any) => <div>{children}</div>),
  CardContent: vi.fn(({ children }: any) => <div>{children}</div>),
  CardHeader: vi.fn(({ children }: any) => <div>{children}</div>),
  CardTitle: vi.fn(({ children }: any) => <h1>{children}</h1>),
}));

describe('TaskForm', () => {
  const mockSubmit = vi.fn();
  const mockCancel = vi.fn();
  const mockTechnicians = [
    { id: 'tech1', name: 'Tech One', email: 'tech1@example.com' },
    { id: 'tech2', name: 'Tech Two', email: 'tech2@example.com' },
  ];

  const mockTask: Task = {
    id: 'task1',
    title: 'Existing Task',
    description: 'Existing Description',
    address: 'Existing Address',
    latitude: 10,
    longitude: 20,
    status: 'in_progress',
    priority: 'medium',
    category: 'installation',
    due_date: '2024-05-01T10:00:00.000Z',
    customer_name: 'Existing Customer',
    customer_phone: '123-456-7890',
    estimated_time: 90,
    technician_id: 'tech1',
    created_at: '', updated_at: '', version: 1, synced: 0,
  };

  const mockUseFormReturn = {
    register: vi.fn(() => ({})),
    handleSubmit: vi.fn((cb: any) => (e: React.FormEvent) => { e.preventDefault(); cb({}); }),
    control: {},
    formState: { errors: {} },
    setValue: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useForm).mockReturnValue(mockUseFormReturn as never);
    vi.mocked(useWatch).mockReturnValue(undefined); // Default for watched values
    vi.mocked(useQuery).mockReturnValue({ data: mockTechnicians } as never);
  });

  it('should render all form fields', () => {
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    expect(screen.getByLabelText('Task Title *')).toBeInTheDocument();
    expect(screen.getByText('Priority *')).toBeInTheDocument();
    expect(screen.getByText('Status *')).toBeInTheDocument();
    expect(screen.getByText('Category *')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer Phone *')).toBeInTheDocument();
    expect(screen.getByLabelText('Estimated Time (minutes) *')).toBeInTheDocument();
    expect(screen.getByLabelText('Due Date *')).toBeInTheDocument();
    expect(screen.getByLabelText('Address *')).toBeInTheDocument();
    expect(screen.getByLabelText('Work Description *')).toBeInTheDocument();
    expect(screen.getByText('Assign to Technician')).toBeInTheDocument();
  });

  it('should initialize with default values when no task is provided', () => {
    vi.mocked(useForm).mockReturnValue({
      ...mockUseFormReturn,
      defaultValues: {
        title: '',
        description: '',
        address: '',
        latitude: 0,
        longitude: 0,
        status: 'assigned',
        priority: 'medium',
        category: 'repair',
        due_date: '',
        customer_name: '',
        customer_phone: '',
        estimated_time: 60,
        technician_id: undefined,
      },
    } as never);
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    expect(useForm).toHaveBeenCalledWith(expect.objectContaining({
      defaultValues: expect.objectContaining({
        title: '',
        description: '',
        address: '',
        status: 'assigned',
        priority: 'medium',
        category: 'repair',
        estimated_time: 60,
      }),
    }));
  });

  it('should initialize with task values when task is provided', () => {
    vi.mocked(useForm).mockReturnValue({
      ...mockUseFormReturn,
      defaultValues: {
        title: mockTask.title,
        description: mockTask.description,
        address: mockTask.address,
        latitude: mockTask.latitude,
        longitude: mockTask.longitude,
        status: mockTask.status,
        priority: mockTask.priority,
        category: mockTask.category,
        due_date: '2024-05-01T10:00',
        customer_name: mockTask.customer_name,
        customer_phone: mockTask.customer_phone,
        estimated_time: mockTask.estimated_time,
        technician_id: mockTask.technician_id,
      },
    } as never);
    render(<TaskForm task={mockTask} onSubmit={mockSubmit} onCancel={mockCancel} />);

    expect(mockUseFormReturn.reset).toHaveBeenCalledWith(expect.objectContaining({
      title: mockTask.title,
      description: mockTask.description,
      address: mockTask.address,
      status: mockTask.status,
      priority: mockTask.priority,
      category: mockTask.category,
      customer_name: mockTask.customer_name,
      customer_phone: mockTask.customer_phone,
      estimated_time: mockTask.estimated_time,
      technician_id: mockTask.technician_id,
    }));
  });

  it('should display validation errors', async () => {
    (useForm as any).mockReturnValue({
      ...mockUseFormReturn,
      formState: { errors: { title: { message: 'Title is required' } } },
      handleSubmit: vi.fn((cb: any) => (e: React.FormEvent) => { e.preventDefault(); cb({}); }),
    });
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  it('should call onSubmit with form data on successful submission', async () => {
    (useForm as any).mockReturnValue({
      ...mockUseFormReturn,
      handleSubmit: vi.fn((cb: any) => (e: React.FormEvent) => { e.preventDefault(); cb({ title: 'New Task', description: 'Desc', address: 'Addr', latitude: 0, longitude: 0, status: 'assigned', priority: 'low', category: 'repair', due_date: '2024-01-01T00:00:00.000Z', customer_name: 'Cust', customer_phone: 'Phone', estimated_time: 60, technician_id: 'tech1' }); }),
    });
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Task',
      }));
    });
  });

  it('should call onCancel when Cancel button is clicked', () => {
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('should fetch technicians if not provided via props', () => {
    vi.mocked(useQuery).mockReturnValue({ data: mockTechnicians } as never);
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['technicians'],
      enabled: true,
    }));
    expect(screen.getByText('Tech One (tech1@example.com)')).toBeInTheDocument();
  });

  it('should use technicians from props if provided', () => {
    vi.mocked(useQuery).mockReturnValue({ data: [] } as never); // Ensure it's not fetching
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} technicians={mockTechnicians} />);
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
    }));
    expect(screen.getByText('Tech One (tech1@example.com)')).toBeInTheDocument();
  });

  it('should disable submit button when loading is true', () => {
    render(<TaskForm onSubmit={mockSubmit} onCancel={mockCancel} loading={true} />);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});
