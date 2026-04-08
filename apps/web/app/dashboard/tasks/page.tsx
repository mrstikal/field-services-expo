'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Task,
  TaskCreateInput,
  TaskListResponse,
  TaskStatus,
} from '@field-service/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TaskDialog from '@/components/task-dialog';
import { useRealtimeTasks } from '@/lib/hooks/use-realtime-tasks';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

const ITEMS_PER_PAGE = 20;

type TaskFilter = 'all' | TaskStatus;

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'assigned':
      return 'bg-blue-100 text-blue-800';
    case 'in_progress':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

async function fetchTasks(
  filter: TaskFilter,
  page: number
): Promise<TaskListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(ITEMS_PER_PAGE),
  });

  if (filter !== 'all') {
    params.set('status', filter);
  }

  const response = await authenticatedFetch(`/api/tasks?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load tasks.');
  }

  return payload as TaskListResponse;
}

export default function TasksPage() {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  useRealtimeTasks();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', filter, page],
    queryFn: () => fetchTasks(filter, page),
  });

  const tasks = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const handleCreateTask = async (payload: TaskCreateInput) => {
    setLoading(true);
    try {
      const response = await authenticatedFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error ?? 'Failed to create task.');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTask = async (payload: TaskCreateInput) => {
    if (!editingTask) return;

    setLoading(true);
    try {
      const response = await authenticatedFetch(
        `/api/tasks/${editingTask.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        alert(result.error ?? 'Failed to update task.');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
      setEditingTask(undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks Management</h1>
          <p className="mt-2 text-gray-600">
            Manage and assign tasks to technicians
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            setEditingTask(undefined);
            setDialogOpen(true);
          }}
        >
          Create New Task
        </Button>
      </div>

      <div className="mb-6 flex gap-2">
        {(['all', 'assigned', 'in_progress', 'completed'] as const).map(
          status => (
            <button
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              key={status}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
              type="button"
            >
              {status === 'all'
                ? 'All Tasks'
                : status.replace('_', ' ').charAt(0).toUpperCase() +
                  status.slice(1).replace('_', ' ')}
            </button>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {filter === 'all'
              ? 'All Tasks'
              : `${filter.replace('_', ' ')} Tasks`}{' '}
            ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-600">
              Error: {error.message}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No tasks found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Address
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50"
                        key={task.id}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {task.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {task.description.substring(0, 50)}...
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {task.customer_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {task.customer_phone}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {task.address}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getPriorityColor(task.priority)}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(task.status)}`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {task.estimated_time} min
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              setEditingTask(task);
                              setDialogOpen(true);
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing{' '}
                  {Math.min((page - 1) * ITEMS_PER_PAGE + 1, totalCount)} to{' '}
                  {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}{' '}
                  tasks
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={page <= 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    disabled={page >= totalPages}
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TaskDialog
        loading={loading}
        onCancel={() => {
          setDialogOpen(false);
          setEditingTask(undefined);
        }}
        onOpenChange={setDialogOpen}
        onSubmit={editingTask ? handleEditTask : handleCreateTask}
        open={dialogOpen}
        task={editingTask}
      />
    </div>
  );
}
