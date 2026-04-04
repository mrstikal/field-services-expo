'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Task {
  id: string;
  title: string;
  description: string;
  address: string;
  status: 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customer_name: string;
  customer_phone: string;
  estimated_time: number;
  technician_id: string | null;
}

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

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: async () => {
      let query = supabase.from('tasks').select('*');
      
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
  });

  const filteredTasks = tasks as Task[];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks Management</h1>
          <p className="text-gray-600 mt-2">Manage and assign tasks to technicians</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Create New Task
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {(['all', 'assigned', 'in_progress', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'all' ? 'All Tasks' : status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filter === 'all' ? 'All Tasks' : `${filter.replace('_', ' ')} Tasks`} ({filteredTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tasks found</div>
          ) : (
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
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
