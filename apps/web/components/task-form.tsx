'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  Task,
  TaskCategory,
  TaskCreateInput,
  TaskPriority,
  TaskStatus,
} from '@field-service/shared-types';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

const UNASSIGNED = '__unassigned__';

const formatDateTimeLocal = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  address: z.string().min(1, 'Address is required').max(500),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  status: z.enum(['assigned', 'in_progress', 'completed'] as const),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  category: z.enum([
    'repair',
    'installation',
    'maintenance',
    'inspection',
  ] as const),
  due_date: z
    .string()
    .min(1, 'Due date is required')
    .transform(value => new Date(value).toISOString()),
  customer_name: z.string().min(1, 'Customer name is required').max(200),
  customer_phone: z.string().min(1, 'Customer phone is required').max(50),
  estimated_time: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  technician_id: z.string(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TechnicianOption {
  id: string;
  name: string;
  email: string;
}

interface TaskFormProps {
  readonly task?: Task;
  readonly onSubmit: (data: TaskCreateInput) => Promise<void>;
  readonly onCancel: () => void;
  readonly loading?: boolean;
}

export default function TaskForm({
  task,
  onSubmit,
  onCancel,
  loading = false,
}: TaskFormProps) {
  const { data: fetchedTechnicians = [] } = useQuery({
    queryKey: ['technician-options'],
    queryFn: async () => {
      const response = await authenticatedFetch('/api/technicians', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Unable to load technicians.');
      }
      return (await response.json()) as TechnicianOption[];
    },
  });
  const technicians = fetchedTechnicians;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    reset,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      address: task?.address ?? '',
      latitude: task?.latitude ?? null,
      longitude: task?.longitude ?? null,
      status: task?.status ?? 'assigned',
      priority: task?.priority ?? 'medium',
      category: task?.category ?? 'repair',
      due_date: formatDateTimeLocal(task?.due_date),
      customer_name: task?.customer_name ?? '',
      customer_phone: task?.customer_phone ?? '',
      estimated_time: task?.estimated_time ?? 60,
      technician_id: task?.technician_id ?? UNASSIGNED,
    },
  });

  useEffect(() => {
    reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      address: task?.address ?? '',
      latitude: task?.latitude ?? null,
      longitude: task?.longitude ?? null,
      status: task?.status ?? 'assigned',
      priority: task?.priority ?? 'medium',
      category: task?.category ?? 'repair',
      due_date: formatDateTimeLocal(task?.due_date),
      customer_name: task?.customer_name ?? '',
      customer_phone: task?.customer_phone ?? '',
      estimated_time: task?.estimated_time ?? 60,
      technician_id: task?.technician_id ?? UNASSIGNED,
    });
  }, [task, reset]);

  const watchedPriority = useWatch({ control, name: 'priority' });
  const watchedStatus = useWatch({ control, name: 'status' });
  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedTechnicianId = useWatch({ control, name: 'technician_id' });

  const submitForm = async (values: TaskFormValues) => {
    await onSubmit({
      ...values,
      technician_id:
        values.technician_id === UNASSIGNED ? null : values.technician_id,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{task ? 'Edit Task' : 'Create New Task'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(submitForm)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title"
                {...register('title')}
              />
              {errors.title ? (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select
                onValueChange={value =>
                  setValue('priority', value as TaskPriority)
                }
                value={watchedPriority}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                onValueChange={value => setValue('status', value as TaskStatus)}
                value={watchedStatus}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                onValueChange={value =>
                  setValue('category', value as TaskCategory)
                }
                value={watchedCategory}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                placeholder="Customer name"
                {...register('customer_name')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">Customer Phone *</Label>
              <Input
                id="customer_phone"
                placeholder="+420 XXX XXX XXX"
                {...register('customer_phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_time">Estimated Time (minutes) *</Label>
              <Input
                id="estimated_time"
                placeholder="Time in minutes"
                type="number"
                {...register('estimated_time', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="datetime-local"
                {...register('due_date')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                placeholder="Address where the work will take place"
                {...register('address')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                {...register('latitude', {
                  setValueAs: value => (value === '' ? null : Number(value)),
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                {...register('longitude', {
                  setValueAs: value => (value === '' ? null : Number(value)),
                })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Work Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the work to be performed..."
                rows={4}
                {...register('description')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="technician_id">Assign to Technician</Label>
              <Select
                onValueChange={value => setValue('technician_id', value)}
                value={watchedTechnicianId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name} ({tech.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? 'Saving...' : task ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
