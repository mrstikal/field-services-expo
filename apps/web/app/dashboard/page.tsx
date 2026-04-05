'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MapView from '@/components/map-view';

interface Task {
  id: string;
  status: 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface Technician {
  id: string;
  name: string;
  is_online: boolean;
}

export default function DashboardPage() {
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: technicians = [], isLoading: techLoading, error: techError } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'technician');
      if (error) throw error;
      return data || [];
    },
  });

  if (tasksLoading || techLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-2">Welcome back, Dispatcher!</p>
          <div className="mt-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-gray-500 mt-2">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (tasksError || techError) {
    return (
      <div className="p-8">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-2">Welcome back, Dispatcher!</p>
          <div className="mt-4">
            <p className="text-red-600">Error: {tasksError?.message || techError?.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    totalTasks: tasks.length,
    assignedTasks: tasks.filter((t: Task) => t.status === 'assigned').length,
    inProgressTasks: tasks.filter((t: Task) => t.status === 'in_progress').length,
    completedTasks: tasks.filter((t: Task) => t.status === 'completed').length,
    onlineTechnicians: technicians.filter((t: Technician) => t.is_online).length,
    totalTechnicians: technicians.length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">Welcome back, Dispatcher!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalTasks}
            </div>
            <p className="text-xs text-gray-500 mt-2">All tasks in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Assigned Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.assignedTasks}
            </div>
            <p className="text-xs text-gray-500 mt-2">Waiting to be started</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {stats.inProgressTasks}
            </div>
            <p className="text-xs text-gray-500 mt-2">Currently being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completed Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.completedTasks}
            </div>
            <p className="text-xs text-gray-500 mt-2">Successfully finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Online Technicians
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.onlineTechnicians}/{stats.totalTechnicians}
            </div>
            <p className="text-xs text-gray-500 mt-2">Available technicians</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.totalTasks > 0
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-gray-500 mt-2">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Assigned</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{
                        width: `${
                          stats.totalTasks > 0
                            ? (stats.assignedTasks / stats.totalTasks) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{stats.assignedTasks}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">In Progress</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-600"
                      style={{
                        width: `${
                          stats.totalTasks > 0
                            ? (stats.inProgressTasks / stats.totalTasks) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{stats.inProgressTasks}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completed</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600"
                      style={{
                        width: `${
                          stats.totalTasks > 0
                            ? (stats.completedTasks / stats.totalTasks) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{stats.completedTasks}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technician Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {technicians.slice(0, 5).map((tech: Technician) => (
                <div className="flex items-center justify-between" key={tech.id}>
                  <span className="text-sm text-gray-700">{tech.name}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        tech.is_online ? 'bg-green-600' : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs text-gray-500">
                      {tech.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map View */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Technicians Map</CardTitle>
        </CardHeader>
        <CardContent>
          <MapView height="400px" />
        </CardContent>
      </Card>
    </div>
  );
}
