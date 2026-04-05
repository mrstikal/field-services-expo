'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TaskForm from './task-form';
import { Task } from '@field-service/shared-types';

type TaskFormData = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'version' | 'synced' | 'technician_id'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  synced?: number;
  technician_id?: string;
};

interface TaskDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly task?: Task;
  readonly onSubmit: (data: TaskFormData) => Promise<void>;
  readonly onCancel: () => void;
  readonly loading?: boolean;
}

export default function TaskDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
  onCancel,
  loading = false
}: TaskDialogProps) {
  const handleCancel = () => {
    onCancel();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleCancel();
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (data: TaskFormData) => {
    await onSubmit(data);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <TaskForm
            loading={loading}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
            task={task}
          />
        </div>
        
        <DialogFooter>
          <Button 
            disabled={loading} 
            onClick={handleCancel}
            variant="outline"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
