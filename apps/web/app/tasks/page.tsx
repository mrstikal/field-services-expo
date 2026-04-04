import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MapPin, Clock, User } from 'lucide-react';

export default function TasksPage() {
  const tasks = [
    {
      id: 'task1',
      title: 'Switchboard repair',
      address: 'Václavské Square 1, Prague 1',
      status: 'assigned',
      priority: 'urgent',
      dueDate: '2026-04-05',
      technician: null,
    },
    {
      id: 'task2',
      title: 'Circuit breaker installation',
      address: 'Freedom Square 5, Brno',
      status: 'assigned',
      priority: 'high',
      dueDate: '2026-04-06',
      technician: null,
    },
    {
      id: 'task3',
      title: 'Switchboard maintenance',
      address: 'Vinohrady, Prague 2',
      status: 'in_progress',
      priority: 'medium',
      dueDate: '2026-04-04',
      technician: 'Peter Johnson',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New task
        </Button>
      </div>

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{task.title}</h3>
                    <Badge variant={task.priority === 'urgent' ? 'destructive' : 'secondary'}>
                      {task.priority}
                    </Badge>
                    <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                      {task.status}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin className="mr-2 h-4 w-4" />
                    {task.address}
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="mr-2 h-4 w-4" />
                    Due: {task.dueDate}
                  </div>
                  {task.technician && (
                    <div className="flex items-center text-sm text-gray-500">
                      <User className="mr-2 h-4 w-4" />
                      {task.technician}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                  <Button variant="outline" size="sm">
                    Map
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}