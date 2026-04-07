import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeSyncService } from '../realtime-sync';
import { supabase } from '@/lib/supabase';

vi.mock('../supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('RealtimeSyncService', () => {
  let service: RealtimeSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use getInstance to ensure we're testing the singleton
    service = RealtimeSyncService.getInstance();
    service.unsubscribeAll();
  });

  it('should be a singleton', () => {
    const instance1 = RealtimeSyncService.getInstance();
    const instance2 = RealtimeSyncService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should subscribe to tasks', () => {
    const callback = vi.fn();
    const subscription = service.subscribeToTasks(callback);

    expect(supabase.channel).toHaveBeenCalledWith('tasks-changes');
    expect(subscription).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe('function');
  });

  it('should subscribe to technician updates', () => {
    const callback = vi.fn();
    const technicianId = 'tech-123';
    service.subscribeToTechnicianUpdates(technicianId, callback);

    expect(supabase.channel).toHaveBeenCalledWith(`technician-${technicianId}`);
  });

  it('should subscribe to reports', () => {
    const callback = vi.fn();
    service.subscribeToReports(callback);

    expect(supabase.channel).toHaveBeenCalledWith('reports-changes');
  });

  it('should unsubscribe from a specific subscription', () => {
    const callback = vi.fn();
    const channelMock = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    vi.mocked(supabase.channel).mockReturnValue(channelMock as never);

    // We can't easily get the subscription ID because it's generated with Date.now()
    // but we can test if removeChannel is called when we call unsubscribe on the returned object
    const subscription = service.subscribeToTasks(callback);
    subscription.unsubscribe();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channelMock);
  });

  it('should broadcast task event', async () => {
    const taskId = 'task-123';
    const updateMock = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(updateMock as never);

    await service.broadcastTaskEvent(taskId);

    expect(supabase.from).toHaveBeenCalledWith('tasks');
    expect(updateMock.update).toHaveBeenCalled();
    expect(updateMock.eq).toHaveBeenCalledWith('id', taskId);
  });
});
