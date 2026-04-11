'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

type TaskFilter = 'all' | TaskStatus | 'overdue' | 'archived';

const taskFilterOptions  = [
  'all',
  'assigned',
  'in_progress',
  'completed',
  'overdue',
  'archived',
] as const satisfies readonly TaskFilter[];

const getFilterLabel = (filter: TaskFilter) => {
  switch (filter) {
    case 'all':
      return 'All';
    case 'overdue':
      return 'Overdue';
    case 'archived':
      return 'Archived';
    default:
      return `${filter.replace('_', ' ')}`;
  }
};

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

const getDueDateColor = (dueDate: string): string => {
  if (!dueDate) {
    return 'text-gray-600';
  }
  const due = new Date(dueDate);
  const now = new Date();
  if (isNaN(due.getTime()) || due <= now) {
    return 'text-gray-600';
  }
  return 'text-red-600 font-semibold';
};

async function fetchTasks(
  filter: TaskFilter,
  page: number
): Promise<TaskListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(ITEMS_PER_PAGE),
  });

  if (filter === 'overdue') {
    params.set('overdue', 'true');
  } else if (filter === 'archived') {
    params.set('archived', 'true');
  } else if (filter !== 'all') {
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

async function readJsonResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function TasksPage() {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? '';
  const lastHandledEditTaskIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useRealtimeTasks();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', filter, page],
    queryFn: () => fetchTasks(filter, page),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const tasks = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const clearEditTaskQueryParam = useCallback(() => {
    if (!pathname) {
      return;
    }
    const params = new URLSearchParams(searchParamsString);
    params.delete('editTaskId');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParamsString]);

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const editTaskIdParam = searchParams.get('editTaskId');
    if (!editTaskIdParam || lastHandledEditTaskIdRef.current === editTaskIdParam) {
      return;
    }
    const editTaskId = editTaskIdParam;

    const existingTask = tasks.find(task => task.id === editTaskId);
    if (existingTask) {
      setEditingTask(existingTask);
      setDialogOpen(true);
      lastHandledEditTaskIdRef.current = editTaskId;
      clearEditTaskQueryParam();
      return;
    }

    let cancelled = false;
    void (async () => {
      const response = await authenticatedFetch(`/api/tasks/${editTaskId}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }

      const task = (await response.json()) as Task;
      if (cancelled) {
        return;
      }

      setEditingTask(task);
      setDialogOpen(true);
      lastHandledEditTaskIdRef.current = editTaskId;
      clearEditTaskQueryParam();
    })();

    return () => {
      cancelled = true;
    };
  }, [clearEditTaskQueryParam, searchParams, tasks]);

  const handleCreateTask = async (payload: TaskCreateInput) => {
    setLoading(true);
    try {
      const response = await authenticatedFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        const errorMessage =
          result && typeof result === 'object' && 'error' in result
            ? String(result.error)
            : 'Failed to create task.';
        alert(errorMessage);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTask = async (taskId: string, payload: TaskCreateInput) => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        const errorMessage =
          result && typeof result === 'object' && 'error' in result
            ? String(result.error)
            : 'Failed to update task.';
        alert(errorMessage);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
      setEditingTask(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveTask = async (taskId: string) => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await readJsonResponse(response);
        const errorMessage =
          result && typeof result === 'object' && 'error' in result
            ? String(result.error)
            : 'Failed to archive task.';
        alert(errorMessage);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleted_at: null }),
        }
      );
      if (!response.ok) {
        const result = await readJsonResponse(response);
        const errorMessage =
          result && typeof result === 'object' && 'error' in result
            ? String(result.error)
            : 'Failed to restore task.';
        alert(errorMessage);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
        {taskFilterOptions.map(status => (
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
              {getFilterLabel(status)}
            </button>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getFilterLabel(filter)} ({totalCount})</CardTitle>
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
                        Due To
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
                          <td className="px-4 py-3 text-sm">
                            <p className={getDueDateColor(task.due_date ?? '')}>
                              {task.due_date 
                                ? new Date(task.due_date).toLocaleDateString('cs-CZ') 
                                : 'No due date'}
                            </p>
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
                          {task.deleted_at ? (
                            <button
                              className="text-sm font-medium text-green-600 hover:text-green-800"
                              onClick={() => handleRestoreTask(task.id)}
                              type="button"
                            >
                              Restore
                            </button>
                          ) : (
                            <span className="flex items-center">
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
                              <button
                                className="ml-2 text-sm font-medium text-red-600 hover:text-red-800"
                                onClick={() => handleArchiveTask(task.id)}
                                type="button"
                              >
                                Archive
                              </button>
                            </span>
                          )}
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
          clearEditTaskQueryParam();
        }}
        onOpenChange={setDialogOpen}
        onSubmit={
          editingTask
            ? payload => handleEditTask(editingTask.id, payload)
            : handleCreateTask
        }
        open={dialogOpen}
        task={editingTask}
      />
    </div>
  );
}
