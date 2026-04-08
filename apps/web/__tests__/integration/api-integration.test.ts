import { POST as pullPOST } from '../../app/api/sync/pull/route';
import { POST as pushPOST } from '../../app/api/sync/push/route';
import { NextRequest } from 'next/server';
import { mockSupabaseAuth, mockSupabaseClient } from '@/vitest.setup';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

describe('Web Sync API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: unknown, token = 'test-token') => {
    const headers = new Map();
    headers.set('authorization', `Bearer ${token}`);
    
    return {
      headers: {
        get: (name: string) => headers.get(name.toLowerCase()) || null,
      },
      json: async () => body,
    } as unknown as NextRequest;
  };

  describe('Pull Sync API Workflow', () => {
    it('should sync tasks and reports for a technician since last timestamp', async () => {
      const techId = 'tech-1';
      const mockTasks = [{ id: 'task-1', technician_id: techId, updated_at: '2023-01-01T10:00:00Z' }];

      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: techId, email: 'tech@test.com' } }, 
        error: null 
      } as never);

      const usersQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: techId, role: 'technician' }], error: null }),
      };

      const tasksQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
      };

      const reportsQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const locationsQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabaseClient.from.mockImplementation((((table: string) => {
        if (table === 'users') return usersQuery as never;
        if (table === 'tasks') return tasksQuery as never;
        if (table === 'reports') return reportsQuery as never;
        if (table === 'locations') return locationsQuery as never;
        throw new Error(`Unexpected table ${table}`);
      }) as unknown) as never);

      const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
      const response = await pullPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tasks).toHaveLength(1);
      expect(data.data.tasks[0].id).toBe('task-1');
    });
  });

  describe('Push Sync API Workflow', () => {
    it('should process creates and updates from mobile client', async () => {
      const techId = 'tech-1';
      mockSupabaseAuth.getUser.mockResolvedValue({ 
        data: { user: { id: techId, email: 'tech@test.com' } }, 
        error: null 
      } as never);

      const usersQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: techId, role: 'technician' }], error: null }),
      };

      const taskLimitResults = [
        { data: [], error: null },
        { data: [{ technician_id: techId }], error: null },
      ];

      const tasksQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => Promise.resolve(taskLimitResults.shift() ?? { data: [], error: null })),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const reportsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const syncQueueQuery = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabaseClient.from.mockImplementation((((table: string) => {
        if (table === 'users') return usersQuery as never;
        if (table === 'tasks') return tasksQuery as never;
        if (table === 'reports') return reportsQuery as never;
        if (table === 'sync_queue') return syncQueueQuery as never;
        throw new Error(`Unexpected table ${table}`);
      }) as unknown) as never);

      const pushData = {
        changes: [
          {
            id: 'client-uuid-1',
            type: 'task',
            action: 'create',
            data: { id: 'task-uuid', title: 'Local Task', description: 'desc', technician_id: techId, due_date: new Date().toISOString(), updated_at: new Date().toISOString() },
            version: 1
          },
          {
            id: 'client-uuid-2',
            type: 'report',
            action: 'create',
            data: { id: 'report-uuid', task_id: 'task-1', status: 'completed', updated_at: new Date().toISOString() },
            version: 1
          }
        ]
      };

      const req = createRequest(pushData);
      const response = await pushPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.itemResults).toHaveLength(2);
      expect(data.results.itemResults[0].status).toBe('success');
      expect(data.results.itemResults[1].status).toBe('success');
    });

    it('should handle unauthorized push requests', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never);
      const req = createRequest({ changes: [] });
      const response = await pushPOST(req);
      expect(response.status).toBe(401);
    });
  });
});
