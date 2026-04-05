'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TaskDialog from '@/components/task-dialog';
import { Task } from '@field-service/shared-types';
import { useRealtimeTasks } from '@/lib/hooks/use-realtime-tasks';

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

export default function TasksPage() {
  const [filter, setFilter] = useState<'all' | 'assigned' | 'in_progress' | 'completed'>('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  
  const ITEMS_PER_PAGE = 20;
  const queryClient = useQueryClient();

  // Enable real-time updates for tasks
  useRealtimeTasks();

  const { data: paginatedTasks = {data: [], totalCount: 0}, isLoading, error } = useQuery({
    queryKey: ['tasks', filter, page],
    queryFn: async () => {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      let query = supabase.from('tasks').select('*', { count: 'exact' });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Map data to ensure all required Task fields are present
      const mappedData: Task[] = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        address: item.address,
        latitude: item.latitude || 0,
        longitude: item.longitude || 0,
        status: item.status,
        priority: item.priority,
        category: item.category || 'repair',
        due_date: item.due_date || new Date().toISOString(),
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        estimated_time: item.estimated_time || 60,
        technician_id: item.technician_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        version: item.version || 1,
        synced: item.synced || 0
      }));
      
      return { data: mappedData, totalCount: count || 0 };
    },
  });

  const { data: tasks = [], totalCount = 0 } = paginatedTasks;
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  
  type TaskFormData = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'version' | 'synced'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
    version?: number;
    synced?: number;
  };

  const handleCreateTask = async (data: TaskFormData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        alert(result.error || 'Failed to create task');
        return;
      }
      
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
    } catch {
      alert('An error occurred while creating the task');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEditTask = async (data: TaskFormData) => {
    if (!editingTask?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        alert(result.error || 'Failed to update task');
        return;
      }
      
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
      setEditingTask(undefined);
    } catch {
      alert('An error occurred while updating the task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks Management</h1>
          <p className="text-gray-600 mt-2">Manage and assign tasks to technicians</p>
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

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {(['all', 'assigned', 'in_progress', 'completed'] as const).map((status) => (
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
            key={status}
            onClick={() => {
              setFilter(status);
              setPage(1); // Reset to first page when filter changes
            }}
          >
            {status === 'all' ? 'All Tasks' : status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filter === 'all' ? 'All Tasks' : `${filter.replace('_', ' ')} Tasks`} ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">Error: {error.message}</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tasks found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Priority</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Time</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr className="border-b border-gray-100 hover:bg-gray-50" key={task.id}>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{task.title}</p>
                            <p className="text-sm text-gray-500">{task.description.substring(0, 50)}...</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{task.customer_name}</p>
                            <p className="text-sm text-gray-500">{task.customer_phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{task.address}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{task.estimated_time} min</td>
                        <td className="py-3 px-4">
                          <button 
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-4"
                            onClick={() => {
                              setEditingTask(task);
                              setDialogOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  Showing {Math.min((page - 1) * ITEMS_PER_PAGE + 1, totalCount)} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} tasks
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
