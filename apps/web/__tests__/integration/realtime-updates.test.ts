import { RealtimeSyncService } from '@lib/realtime-sync';
import { supabase } from '@/lib/supabase';

// Mock supabase (mocks are usually in vitest.setup.ts, but we need specific control here)
vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Web Realtime Updates Integration', () => {
  let service: RealtimeSyncService;
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = RealtimeSyncService.getInstance();
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);
  });

  it('should manage multiple task subscriptions', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const sub1 = service.subscribeToTasks(callback1);
    const sub2 = service.subscribeToTasks(callback2);

    expect(supabase.channel).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^tasks-changes-\d+$/)
    );
    expect(supabase.channel).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^tasks-changes-\d+$/)
    );
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    sub1.unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it(' should subscribe to technician updates with filter', () => {
    const callback = vi.fn();
    const technicianId = 'tech-123';

    service.subscribeToTechnicianUpdates(technicianId, callback);

    expect(supabase.channel).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^technician-${technicianId}-\\d+$`))
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        table: 'users',
        filter: `id=eq.${technicianId}`,
      }),
      expect.any(Function)
    );
  });

  it('should broadcast task event via database update', async () => {
    const taskId = 'task-1';
    const mockUpdate = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockUpdate as any);

    await service.broadcastTaskEvent(taskId);

    expect(supabase.from).toHaveBeenCalledWith('tasks');
    expect(mockUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updated_at: expect.any(String),
      })
    );
    expect(mockUpdate.eq).toHaveBeenCalledWith('id', taskId);
  });
});
