import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Task } from '@field-service/shared-types';
import { useIsOnline } from '@/lib/hooks/use-network-status';
import { useAuth } from '@/lib/auth-context';

/**
 * Hook for real-time task updates using Supabase Realtime
 * Automatically invalidates TanStack Query cache when tasks change
 */
export function useRealtimeTasks() {
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const { user } = useAuth();
  const notifiedTaskIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    // Subscribe to all task changes (INSERT, UPDATE, DELETE)
    const subscription = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'tasks',
        },
        payload => {
          console.log('Task change detected:', payload);

          // Invalidate the tasks query to refetch
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          // If it's a specific task update, also invalidate that query
          if (payload.new && 'id' in payload.new) {
            queryClient.invalidateQueries({
              queryKey: ['task', (payload.new as Task).id],
            });
          }

          const newTask = payload.new as Partial<Task> | null;
          const oldTask = payload.old as Partial<Task> | null;
          const isTechnician = user?.role === 'technician';
          const taskId = typeof newTask?.id === 'string' ? newTask.id : null;
          const assignedToCurrentUser =
            typeof newTask?.technician_id === 'string' &&
            newTask.technician_id === user?.id;
          const wasAssignedToCurrentUser =
            typeof oldTask?.technician_id === 'string' &&
            oldTask.technician_id === user?.id;
          const isNewAssignmentForCurrentUser =
            (payload.eventType === 'INSERT' && assignedToCurrentUser) ||
            (payload.eventType === 'UPDATE' &&
              assignedToCurrentUser &&
              !wasAssignedToCurrentUser);

          if (
            isTechnician &&
            taskId &&
            isNewAssignmentForCurrentUser &&
            !notifiedTaskIdsRef.current.has(taskId)
          ) {
            notifiedTaskIdsRef.current.add(taskId);
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            Alert.alert(
              'New task assigned',
              typeof newTask?.title === 'string'
                ? newTask.title
                : 'You have a new assigned task.'
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [isOnline, queryClient, user?.id, user?.role]);
}

/**
 * Hook for real-time updates on a specific task
 */
export function useRealtimeTask(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();

  useEffect(() => {
    if (!taskId || !isOnline) return;

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
          }

          // Also invalidate the tasks list
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isOnline, taskId, queryClient]);
}
