'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TaskForm from './task-form';
import type { Task, TaskCreateInput } from '@field-service/shared-types';

interface TaskDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly task?: Task;
  readonly onSubmit: (data: TaskCreateInput) => Promise<void>;
  readonly onCancel: () => void;
  readonly loading?: boolean;
}

export default function TaskDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
  onCancel,
  loading = false,
}: TaskDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onCancel();
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <TaskForm
            loading={loading}
            onCancel={onCancel}
            onSubmit={onSubmit}
            task={task}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
