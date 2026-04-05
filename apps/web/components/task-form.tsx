'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '@field-service/shared-types';

const formatDateTimeLocal = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const dueDateSchema = z
  .string()
  .min(1, 'Due date is required')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid due date')
  .transform((value) => new Date(value).toISOString());

// Define Zod schema for task
const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().min(1, 'Description is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(['assigned', 'in_progress', 'completed'] as const),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  category: z.enum(['repair', 'installation', 'maintenance', 'inspection'] as const),
  due_date: dueDateSchema,
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_phone: z.string().min(1, 'Customer phone is required'),
  estimated_time: z.number().min(1, 'Estimated time must be greater than 0'),
  technician_id: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: TaskFormValues) => Promise<void>;
  onCancel: () => void;
  technicians?: Array<{ id: string; name: string; email: string }>;
  loading?: boolean;
}

export default function TaskForm({
  task,
  onSubmit,
  onCancel,
  technicians,
  loading = false
}: TaskFormProps) {
  const [techs, setTechs] = useState<Array<{ id: string; name: string; email: string }>>([]);
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    reset,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      address: task?.address || '',
      latitude: task?.latitude || 0,
      longitude: task?.longitude || 0,
      status: task?.status || 'assigned',
      priority: task?.priority || 'medium',
      category: task?.category || 'repair',
      due_date: formatDateTimeLocal(task?.due_date),
      customer_name: task?.customer_name || '',
      customer_phone: task?.customer_phone || '',
      estimated_time: task?.estimated_time || 60,
      technician_id: task?.technician_id || undefined,
    },
  });

  // Use useWatch to track values
  const watchedPriority = useWatch({
    control,
    name: 'priority',
  });
  
  const watchedStatus = useWatch({
    control,
    name: 'status',
  });
  
  const watchedCategory = useWatch({
    control,
    name: 'category',
  });
  
  const watchedTechnicianId = useWatch({
    control,
    name: 'technician_id',
  });

  // If we don't have technicians passed as props, fetch them
  const { data: fetchedTechnicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'technician');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !technicians,
  });

  useEffect(() => {
    if (technicians) {
      setTechs(technicians);
    } else if (fetchedTechnicians) {
      setTechs(fetchedTechnicians);
    }
  }, [technicians, fetchedTechnicians]);

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      reset({
        title: task.title || '',
        description: task.description || '',
        address: task.address || '',
        latitude: task.latitude || 0,
        longitude: task.longitude || 0,
        status: task.status || 'assigned',
        priority: task.priority || 'medium',
        category: task.category || 'repair',
        due_date: formatDateTimeLocal(task.due_date),
        customer_name: task.customer_name || '',
        customer_phone: task.customer_phone || '',
        estimated_time: task.estimated_time || 60,
        technician_id: task.technician_id || undefined,
      });
    }
  }, [task, reset]);

  const onSubmitForm = (data: TaskFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{task ? 'Edit Task' : 'Create New Task'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Enter task title"
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={watchedPriority}
                onValueChange={(value) => setValue('priority', value as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {errors.priority && (
                <p className="text-sm text-red-600">{errors.priority.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={watchedStatus}
                onValueChange={(value) => setValue('status', value as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={watchedCategory}
                onValueChange={(value) => setValue('category', value as TaskCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                {...register('customer_name')}
                placeholder="Customer name"
              />
              {errors.customer_name && (
                <p className="text-sm text-red-600">{errors.customer_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">Customer Phone *</Label>
              <Input
                id="customer_phone"
                {...register('customer_phone')}
                placeholder="+420 XXX XXX XXX"
              />
              {errors.customer_phone && (
                <p className="text-sm text-red-600">{errors.customer_phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_time">Estimated Time (minutes) *</Label>
              <Input
                id="estimated_time"
                type="number"
                {...register('estimated_time', { valueAsNumber: true })}
                placeholder="Time in minutes"
              />
              {errors.estimated_time && (
                <p className="text-sm text-red-600">{errors.estimated_time.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="datetime-local"
                {...register('due_date')}
              />
              {errors.due_date && (
                <p className="text-sm text-red-600">{errors.due_date.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="Address where the work will take place"
              />
              {errors.address && (
                <p className="text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Work Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Detailed description of the work to be performed..."
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="technician_id">Assign to Technician</Label>
              <Select
                value={watchedTechnicianId || ''}
                onValueChange={(value) => setValue('technician_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {techs.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name} ({tech.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : task ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}