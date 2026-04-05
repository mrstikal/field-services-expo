'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Task } from '@field-service/shared-types';

/**
 * Hook for real-time task updates using Supabase Realtime
 * Automatically invalidates TanStack Query cache when tasks change
 */
export function useRealtimeTasks() {
  const queryClient = useQueryClient();

  useEffect(() => {
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
        (payload) => {
          console.log('Task change detected:', payload);

          // Invalidate the tasks query to refetch
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          // If it's a specific task update, also invalidate that query
          if (payload.new && 'id' in payload.new) {
            queryClient.invalidateQueries({
              queryKey: ['task', (payload.new as Task).id],
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
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
        (payload) => {
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
  }, [taskId, queryClient]);
}
