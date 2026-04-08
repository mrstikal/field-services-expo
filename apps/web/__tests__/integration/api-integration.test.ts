import { POST as pullPOST } from '@/app/api/sync/pull/route';
import { POST as pushPOST } from '@/app/api/sync/push/route';
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
      const techId = '550e8400-e29b-41d4-a716-446655440003';
      const mockTasks = [
        {
          id: '650e8400-e29b-41d4-a716-446655440001',
          technician_id: techId,
          updated_at: '2023-01-01T10:00:00Z',
        },
      ];

      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: techId, email: 'tech@test.com' } },
        error: null,
      } as never);

      const tasksQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
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

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === 'tasks') return tasksQuery as never;
        if (table === 'reports') return reportsQuery as never;
        if (table === 'locations') return locationsQuery as never;
        throw new Error(`Unexpected table ${table}`);
      }) as unknown as never);

      const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
      const response = await pullPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tasks).toHaveLength(1);
      expect(data.data.tasks[0].id).toBe(
        '650e8400-e29b-41d4-a716-446655440001'
      );
    });
  });

  describe('Push Sync API Workflow', () => {
    it('should process creates and updates from mobile client', async () => {
      const techId = '550e8400-e29b-41d4-a716-446655440003';
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: techId, email: 'tech@test.com' } },
        error: null,
      } as never);

      const tasksExistingQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const tasksUpsertQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: '650e8400-e29b-41d4-a716-446655440099',
            title: 'Local Task',
            description: 'desc',
          },
          error: null,
        }),
      };

      const tasksMutationQuery = {
        upsert: vi.fn().mockReturnValue(tasksUpsertQuery),
      };

      const reportsExistingQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const reportsUpsertQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: '750e8400-e29b-41d4-a716-446655440099',
            task_id: '650e8400-e29b-41d4-a716-446655440001',
            status: 'completed',
          },
          error: null,
        }),
      };

      const reportsMutationQuery = {
        upsert: vi.fn().mockReturnValue(reportsUpsertQuery),
      };

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === 'tasks') {
          return {
            ...tasksExistingQuery,
            ...tasksMutationQuery,
          } as never;
        }
        if (table === 'reports') {
          return {
            ...reportsExistingQuery,
            ...reportsMutationQuery,
          } as never;
        }
        throw new Error(`Unexpected table ${table}`);
      }) as unknown as never);

      const now = new Date().toISOString();
      const pushData = {
        changes: [
          {
            id: '850e8400-e29b-41d4-a716-446655440001',
            type: 'task',
            action: 'create',
            entityId: '650e8400-e29b-41d4-a716-446655440099',
            data: {
              id: '650e8400-e29b-41d4-a716-446655440099',
              title: 'Local Task',
              description: 'desc',
              address: 'Local Address',
              latitude: null,
              longitude: null,
              status: 'assigned',
              priority: 'medium',
              category: 'repair',
              due_date: now,
              customer_name: 'Customer',
              customer_phone: '+420123456789',
              estimated_time: 60,
              technician_id: techId,
              created_at: now,
              updated_at: now,
              deleted_at: null,
              version: 1,
            },
            version: 1,
          },
          {
            id: '850e8400-e29b-41d4-a716-446655440002',
            type: 'report',
            action: 'create',
            entityId: '750e8400-e29b-41d4-a716-446655440099',
            data: {
              id: '750e8400-e29b-41d4-a716-446655440099',
              task_id: '650e8400-e29b-41d4-a716-446655440001',
              status: 'completed',
              photos: ['photo-1.jpg'],
              form_data: { summary: 'Done' },
              signature: null,
              pdf_url: null,
              created_at: now,
              updated_at: now,
              deleted_at: null,
              version: 1,
            },
            version: 1,
          },
        ],
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
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);
      const req = createRequest({ changes: [] });
      const response = await pushPOST(req);
      expect(response.status).toBe(401);
    });
  });
});
