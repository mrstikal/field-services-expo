import { renderHook } from '@testing-library/react';
import { useRealtimeTasks, useRealtimeTask } from '../hooks/use-realtime-tasks';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

describe('Realtime Hooks', () => {
  const queryClientMock = {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryClient).mockReturnValue(queryClientMock as never);
  });

  describe('useRealtimeTasks', () => {
    it('should subscribe to task changes', () => {
      renderHook(() => useRealtimeTasks());

      expect(supabase.channel).toHaveBeenCalledWith('public:tasks');
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribe = vi.fn();
      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe }),
      } as never);

      const { unmount } = renderHook(() => useRealtimeTasks());
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('useRealtimeTask', () => {
    it('should subscribe to specific task changes', () => {
      const taskId = 'task-123';
      renderHook(() => useRealtimeTask(taskId));

      expect(supabase.channel).toHaveBeenCalledWith(`public:tasks:id=eq.${taskId}`);
    });

    it('should not subscribe if taskId is missing', () => {
      renderHook(() => useRealtimeTask(undefined as unknown as string));

      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('should update query data when receiving new data', () => {
      const taskId = 'task-123';
      let eventCallback: (payload: { new: { id: string; title: string } }) => void = () => {};

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockImplementation((_event: any, _filter: any, callback: any) => {
          eventCallback = callback;
          return {
            subscribe: vi.fn().mockReturnValue({
              unsubscribe: vi.fn(),
            }),
          };
        }),
      } as never);

      renderHook(() => useRealtimeTask(taskId));

      const newData = { id: taskId, title: 'Updated Task' };
      eventCallback({ new: newData });

      expect(queryClientMock.setQueryData).toHaveBeenCalledWith(['task', taskId], newData);
      expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    });
  });
});
