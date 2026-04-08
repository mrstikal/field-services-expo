import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TasksTable, columns } from '@components/tasks-table';
import { Task } from '@field-service/shared-types';
import { useReactTable } from '@tanstack/react-table';

// Mock @tanstack/react-table's useReactTable
vi.mock('@tanstack/react-table', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useReactTable: vi.fn(),
  };
});

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: vi.fn(({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )),
}));

vi.mock('@/components/ui/input', () => ({
  Input: vi.fn(({ onChange, placeholder, value, ...props }: any) => (
    <input
      onChange={onChange}
      placeholder={placeholder}
      value={value}
      {...props}
    />
  )),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: vi.fn(({ children }: any) => <div>{children}</div>),
  DropdownMenuTrigger: vi.fn(({ children }: any) => <>{children}</>),
  DropdownMenuContent: vi.fn(({ children }: any) => <div>{children}</div>),
  DropdownMenuCheckboxItem: vi.fn(
    ({ children, checked, onCheckedChange }: any) => (
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e: any) => onCheckedChange(e.target.checked)}
        />
        {children}
      </label>
    )
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: vi.fn(({ children }: any) => <table>{children}</table>),
  TableHeader: vi.fn(({ children }: any) => <thead>{children}</thead>),
  TableBody: vi.fn(({ children }: any) => <tbody>{children}</tbody>),
  TableRow: vi.fn(({ children }: any) => <tr>{children}</tr>),
  TableHead: vi.fn(({ children }: any) => <th>{children}</th>),
  TableCell: vi.fn(({ children }: any) => <td>{children}</td>),
}));

describe('TasksTable', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Task A',
      customer_name: 'Customer 1',
      address: 'Address 1',
      priority: 'high',
      status: 'assigned',
      estimated_time: 60,
      description: '',
      latitude: 0,
      longitude: 0,
      category: 'repair',
      due_date: '',
      customer_phone: '',
      technician_id: '',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      version: 1,
      synced: 0,
    },
    {
      id: '2',
      title: 'Task B',
      customer_name: 'Customer 2',
      address: 'Address 2',
      priority: 'low',
      status: 'completed',
      estimated_time: 30,
      description: '',
      latitude: 0,
      longitude: 0,
      category: 'repair',
      due_date: '',
      customer_phone: '',
      technician_id: '',
      created_at: '2024-01-02',
      updated_at: '2024-01-02',
      version: 1,
      synced: 0,
    },
  ];

  const mockUseReactTable = useReactTable as any;

  const createMockRow = (task: Task) => {
    const row = {
      id: task.id,
      original: task,
      getIsSelected: () => false,
      getValue: (key: keyof Task) => task[key],
      getVisibleCells: () =>
        columns.map(col => ({
          id: `${task.id}-${(col as any).accessorKey || col.id}`,
          column: { columnDef: col },
          getContext: () => ({ row }),
        })),
    };

    return row;
  };

  const createMockTable = (rows: Task[] = mockTasks) => ({
    getHeaderGroups: () => [
      {
        id: 'headerGroup1',
        headers: columns.map(col => ({
          id: (col as any).accessorKey || col.id,
          column: { columnDef: col },
          isPlaceholder: false,
          getContext: () => ({}),
        })),
      },
    ],
    getRowModel: () => ({
      rows: rows.map(task => createMockRow(task)),
    }),
    getRowCount: () => rows.length,
    getCanPreviousPage: () => false,
    getCanNextPage: () => false,
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    getColumn: vi.fn(() => ({
      setFilterValue: vi.fn(),
      getFilterValue: vi.fn(() => ''),
    })),
    getAllColumns: vi.fn(() =>
      columns.map(col => ({
        id: (col as any).accessorKey || col.id,
        getCanHide: () => true,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      }))
    ),
    getFilteredSelectedRowModel: () => ({ rows: [] }),
    getFilteredRowModel: () => ({ rows }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReactTable.mockReturnValue(createMockTable());
  });

  it('should render the table with tasks', () => {
    render(<TasksTable data={mockTasks} />);
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Customer 1')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('should call setFilterValue when input changes', () => {
    const setFilterValueMock = vi.fn();
    mockUseReactTable.mockReturnValueOnce({
      ...createMockTable(),
      getColumn: vi.fn(() => ({
        setFilterValue: setFilterValueMock,
        getFilterValue: vi.fn(() => ''),
      })),
    });
    render(<TasksTable data={mockTasks} />);
    fireEvent.change(screen.getByPlaceholderText('Filter tasks...'), {
      target: { value: 'Task' },
    });
    expect(setFilterValueMock).toHaveBeenCalledWith('Task');
  });

  it('should toggle column visibility', () => {
    const toggleVisibilityMock = vi.fn();
    mockUseReactTable.mockReturnValueOnce({
      ...createMockTable(),
      getAllColumns: vi.fn(() => [
        {
          id: 'title',
          getCanHide: () => true,
          getIsVisible: () => true,
          toggleVisibility: toggleVisibilityMock,
        },
      ]),
    });
    render(<TasksTable data={mockTasks} />);
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByLabelText('title'));
    expect(toggleVisibilityMock).toHaveBeenCalledWith(false);
  });

  it('should call previousPage when Previous button is clicked', () => {
    const previousPageMock = vi.fn();
    mockUseReactTable.mockReturnValueOnce({
      ...createMockTable(),
      getCanPreviousPage: () => true,
      previousPage: previousPageMock,
    });
    render(<TasksTable data={mockTasks} />);
    fireEvent.click(screen.getByText('Previous'));
    expect(previousPageMock).toHaveBeenCalledTimes(1);
  });

  it('should call nextPage when Next button is clicked', () => {
    const nextPageMock = vi.fn();
    mockUseReactTable.mockReturnValueOnce({
      ...createMockTable(),
      getCanNextPage: () => true,
      nextPage: nextPageMock,
    });
    render(<TasksTable data={mockTasks} />);
    fireEvent.click(screen.getByText('Next'));
    expect(nextPageMock).toHaveBeenCalledTimes(1);
  });

  it('should display "No tasks" when data is empty', () => {
    mockUseReactTable.mockReturnValueOnce({
      ...createMockTable([]),
    });
    render(<TasksTable data={[]} />);
    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });

  it('should call console.log for Edit and Delete buttons', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    render(<TasksTable data={mockTasks} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(consoleSpy).toHaveBeenCalledWith('Edit', '1');
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(consoleSpy).toHaveBeenCalledWith('Delete', '1');
  });
});
