'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Task } from '@field-service/shared-types';
import { realtimeSyncService } from '@/lib/realtime-sync';

function applyRealtimeTaskChange(
  tasks: Task[] | undefined,
  eventType: string,
  nextTask: Task | null,
  previousTask: Partial<Task> | null
) {
  if (!tasks) {
    return tasks;
  }

  if (eventType === 'DELETE') {
    const deletedTaskId =
      typeof previousTask?.id === 'string' ? previousTask.id : null;
    return deletedTaskId
      ? tasks.filter(task => task.id !== deletedTaskId)
      : tasks;
  }

  if (!nextTask) {
    return tasks;
  }

  const existingIndex = tasks.findIndex(task => task.id === nextTask.id);
  if (existingIndex === -1) {
    return eventType === 'INSERT' ? [nextTask, ...tasks] : tasks;
  }

  return tasks.map(task => (task.id === nextTask.id ? nextTask : task));
}

type RealtimeEntity = { id: string };

function applyRealtimeEntityChange<T extends RealtimeEntity>(
  items: T[] | undefined,
  eventType: string,
  nextItem?: T,
  previousItem?: Partial<T>
) {
  if (!items) {
    return items;
  }

  if (eventType === 'DELETE') {
    const deletedItemId =
      typeof previousItem?.id === 'string' ? previousItem.id : null;
    return deletedItemId
      ? items.filter(item => item.id !== deletedItemId)
      : items;
  }

  if (!nextItem) {
    return items;
  }

  const existingIndex = items.findIndex(item => item.id === nextItem.id);
  if (existingIndex === -1) {
    return eventType === 'INSERT' ? [nextItem, ...items] : items;
  }

  return items.map(item => (item.id === nextItem.id ? nextItem : item));
}

/**
 * Hook for real-time task updates using Supabase Realtime
 * Automatically invalidates TanStack Query cache when tasks change
 */
export function useRealtimeTasks() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = realtimeSyncService.subscribeToTasks(payload => {
      const nextTask = payload.newData;
      const previousTask = payload.oldData;

      queryClient.setQueryData<Task[] | undefined>(
        ['tasks'],
        currentTasks =>
          applyRealtimeTaskChange(
            currentTasks,
            payload.eventType,
            nextTask ?? null,
            previousTask ?? null
          )
      );

      queryClient.invalidateQueries({
        queryKey: ['tasks'],
        refetchType: 'active',
      });

      if (payload.eventType === 'DELETE') {
        const deletedTaskId =
          typeof previousTask?.id === 'string' ? previousTask.id : null;
        if (deletedTaskId) {
          queryClient.removeQueries({
            queryKey: ['task', deletedTaskId],
          });
        }
      } else if (nextTask?.id) {
        queryClient.setQueryData(['task', nextTask.id], nextTask);
        queryClient.invalidateQueries({
          queryKey: ['task', nextTask.id],
          refetchType: 'active',
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}

export function useRealtimeTechnicians() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = realtimeSyncService.subscribeToAllTechnicians(
      payload => {
        const nextTechnician =
          payload.newData && typeof payload.newData.id === 'string'
            ? (payload.newData as RealtimeEntity)
            : undefined;
        const previousTechnician =
          payload.oldData && typeof payload.oldData.id === 'string'
            ? (payload.oldData as Partial<RealtimeEntity>)
            : undefined;

        queryClient.setQueryData<RealtimeEntity[] | undefined>(
          ['technicians'],
          currentTechnicians =>
            applyRealtimeEntityChange(
              currentTechnicians,
              payload.eventType,
              nextTechnician,
              previousTechnician
            )
        );

        queryClient.invalidateQueries({
          queryKey: ['technicians'],
          refetchType: 'active',
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}

/**
 * Hook for real-time updates on a specific task
 */
export function useRealtimeTask(taskId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!taskId) return;

    const subscription = supabase
      .channel(`public:tasks:id=eq.${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`,
        },
        payload => {
          console.log('Task detail change detected:', payload);

          // Update the specific task query
          if (payload.new) {
            queryClient.setQueryData(['task', taskId], payload.new);
          } else if (payload.eventType === 'DELETE') {
            queryClient.removeQueries({ queryKey: ['task', taskId] });
          }

          // Also invalidate the tasks list
          queryClient.invalidateQueries({
            queryKey: ['tasks'],
            refetchType: 'active',
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [taskId, queryClient]);
}
