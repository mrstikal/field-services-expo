import { GET } from '../route';
import { NextRequest } from 'next/server';
import { mockSupabaseAuth, mockSupabaseClient, mockSupabaseFrom } from '@/vitest.setup';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

describe('Sync Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (token = 'test-token') => {
    return {
      headers: {
        get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
      },
    } as unknown as NextRequest;
  };

  it('should return pending items count', async () => {
    const userId = 'user-1';
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null } as never);

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: userId }], error: null }),
    };
    const syncQueueQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }], error: null }),
    };

    mockSupabaseClient.from.mockImplementation((((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'sync_queue') return syncQueueQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown) as never);

    const req = createRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pendingItems).toBe(5);
  });
});
