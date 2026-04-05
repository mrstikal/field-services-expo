'use client';

import { useState } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Task } from '@field-service/shared-types';

  export const columns: ColumnDef<Task>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("title")}</div>
      ),
    },
    {
      accessorKey: "customer_name",
      header: "Customer",
      cell: ({ row }) => <div>{row.getValue("customer_name")}</div>,
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => <div>{row.getValue("address")}</div>,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string;
        let badgeClass = 'bg-gray-100 text-gray-800';
        
        switch (priority) {
          case 'urgent':
            badgeClass = 'bg-red-100 text-red-800';
            break;
          case 'high':
            badgeClass = 'bg-orange-100 text-orange-800';
            break;
          case 'medium':
            badgeClass = 'bg-yellow-100 text-yellow-800';
            break;
          case 'low':
            badgeClass = 'bg-green-100 text-green-800';
            break;
        }
        
        return (
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        let badgeClass = 'bg-gray-100 text-gray-800';
        
        switch (status) {
          case 'assigned':
            badgeClass = 'bg-blue-100 text-blue-800';
            break;
          case 'in_progress':
            badgeClass = 'bg-orange-100 text-orange-800';
            break;
          case 'completed':
            badgeClass = 'bg-green-100 text-green-800';
            break;
        }
        
        return (
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
            {status === 'assigned' ? 'Assigned' : 
             status === 'in_progress' ? 'In Progress' : 'Completed'}
          </span>
        );
      },
    },
    {
      accessorKey: "estimated_time",
      header: "Time",
      cell: ({ row }) => <div>{row.getValue("estimated_time")} min</div>,
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => {
        const task = row.original;

        return (
          <div className="flex gap-2">
            <Button onClick={() => console.log('Edit', task.id)} size="sm" variant="outline">
              Edit
            </Button>
            <Button className="text-red-600 hover:text-red-800" onClick={() => console.log('Delete', task.id)} size="sm" variant="outline">
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

interface TasksTableProps {
  readonly data: Task[];
}

export function TasksTable({ data }: TasksTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true }
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          className="max-w-sm"
          onChange={(event) =>
            table.getColumn("title")?.setFilterValue(event.target.value)
          }
          placeholder="Filter tasks..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="ml-auto" variant="outline">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    checked={column.getIsVisible()}
                    className="capitalize"
                    key={column.id}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  No tasks
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
           <Button
             disabled={!table.getCanPreviousPage()}
             onClick={() => table.previousPage()}
             size="sm"
             variant="outline"
           >
             Previous
           </Button>
           <Button
             disabled={!table.getCanNextPage()}
             onClick={() => table.nextPage()}
             size="sm"
             variant="outline"
           >
             Next
           </Button>
        </div>
      </div>
    </div>
  );
}