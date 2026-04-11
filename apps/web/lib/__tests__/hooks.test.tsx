import { renderHook } from '@testing-library/react';
import {
  useRealtimeTasks,
  useRealtimeTechnicians,
  useRealtimeTask,
} from '@lib/hooks/use-realtime-tasks';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeSyncService } from '@lib/realtime-sync';

vi.mock('@lib/realtime-sync', () => ({
  realtimeSyncService: {
    subscribeToTasks: vi.fn(),
    subscribeToAllTechnicians: vi.fn(),
  },
}));

describe('Realtime Hooks', () => {
  const queryClientMock = {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    removeQueries: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryClient).mockReturnValue(queryClientMock as never);
    vi.mocked(realtimeSyncService.subscribeToTasks).mockReturnValue({
      unsubscribe: vi.fn(),
    });
    vi.mocked(realtimeSyncService.subscribeToAllTechnicians).mockReturnValue({
      unsubscribe: vi.fn(),
    });
  });

  describe('useRealtimeTasks', () => {
    it('should subscribe to task changes', () => {
      renderHook(() => useRealtimeTasks());

      expect(realtimeSyncService.subscribeToTasks).toHaveBeenCalled();
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribe = vi.fn();
      vi.mocked(realtimeSyncService.subscribeToTasks).mockReturnValue({
        unsubscribe,
      });

      const { unmount } = renderHook(() => useRealtimeTasks());
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should update the dashboard tasks cache immediately on task updates', () => {
      let eventCallback: (payload: {
        eventType: string;
        newData?: { id: string; title: string; status: string };
        oldData?: { id: string; title: string; status: string };
      }) => void = () => {};

      vi.mocked(realtimeSyncService.subscribeToTasks).mockImplementation(
        callback => {
          eventCallback = callback;
          return { unsubscribe: vi.fn() };
        }
      );

      renderHook(() => useRealtimeTasks());

      const updatedTask = {
        id: 'task-123',
        title: 'Updated Task',
        status: 'completed',
      };
      eventCallback({
        eventType: 'UPDATE',
        newData: updatedTask,
        oldData: {
          id: 'task-123',
          title: 'Original Task',
          status: 'assigned',
        },
      });

      expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
        ['tasks'],
        expect.any(Function)
      );

      const updater = queryClientMock.setQueryData.mock.calls[0][1] as (
        tasks: typeof updatedTask[]
      ) => typeof updatedTask[];
      expect(
        updater([
          { id: 'task-123', title: 'Original Task', status: 'assigned' },
          { id: 'task-456', title: 'Other Task', status: 'assigned' },
        ])
      ).toEqual([
        updatedTask,
        { id: 'task-456', title: 'Other Task', status: 'assigned' },
      ]);
      expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['tasks'],
        refetchType: 'active',
      });
    });
  });

  describe('useRealtimeTechnicians', () => {
    it('should subscribe to technician changes', () => {
      renderHook(() => useRealtimeTechnicians());

      expect(realtimeSyncService.subscribeToAllTechnicians).toHaveBeenCalled();
    });

    it('should update technicians cache immediately on updates', () => {
      let eventCallback: (payload: {
        eventType: string;
        newData?: { id: string; name: string; is_online: boolean };
        oldData?: { id: string; name: string; is_online: boolean };
      }) => void = () => {};

      vi.mocked(
        realtimeSyncService.subscribeToAllTechnicians
      ).mockImplementation(callback => {
        eventCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      renderHook(() => useRealtimeTechnicians());

      const updatedTechnician = {
        id: 'tech-1',
        name: 'Tech One',
        is_online: true,
      };
      eventCallback({
        eventType: 'UPDATE',
        newData: updatedTechnician,
        oldData: { id: 'tech-1', name: 'Tech One', is_online: false },
      });

      expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
        ['technicians'],
        expect.any(Function)
      );
      expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['technicians'],
        refetchType: 'active',
      });
    });
  });

  describe('useRealtimeTask', () => {
    it('should subscribe to specific task changes', () => {
      const taskId = 'task-123';
      renderHook(() => useRealtimeTask(taskId));

      expect(supabase.channel).toHaveBeenCalledWith(
        `public:tasks:id=eq.${taskId}`
      );
    });

    it('should not subscribe if taskId is missing', () => {
      renderHook(() => useRealtimeTask(undefined as unknown as string));

      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('should update query data when receiving new data', () => {
      const taskId = 'task-123';
      let eventCallback: (payload: {
        new: { id: string; title: string };
      }) => void = () => {};

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi
          .fn()
          .mockImplementation((_event: any, _filter: any, callback: any) => {
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

      expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
        ['task', taskId],
        newData
      );
      expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['tasks'],
        refetchType: 'active',
      });
    });
  });
});
