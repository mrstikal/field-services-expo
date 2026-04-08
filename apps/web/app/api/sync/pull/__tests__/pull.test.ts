import { POST } from '@/app/api/sync/pull/route';
import { NextRequest } from 'next/server';
import {
  mockSupabaseAuth,
  mockSupabaseClient,
  mockSupabaseFrom,
} from '@/vitest.setup';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

describe('Pull Sync API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseFrom as never);
  });

  const createRequest = (body: unknown, token = 'test-token') => {
    return {
      headers: {
        get: (name: string) =>
          name === 'authorization' ? `Bearer ${token}` : null,
      },
      json: async () => body,
    } as unknown as NextRequest;
  };

  it('should return 401 if unauthorized', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    } as never);
    const req = createRequest({ lastSyncTimestamp: '2021-01-01T00:00:00Z' });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if lastSyncTimestamp is missing', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);
    mockSupabaseFrom.limit.mockResolvedValueOnce({
      data: [{ id: 'user-1', role: 'dispatcher' }],
      error: null,
    } as never);

    const req = createRequest({});
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('lastSyncTimestamp is required');
  });

  it('should fetch changes since last sync for dispatcher', async () => {
    const userId = 'dispatcher-1';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const mockTasks = [{ id: 'task-1', updated_at: '2023-01-01T10:00:00Z' }];
    const mockReports = [
      { id: 'report-1', task_id: 'task-1', updated_at: '2023-01-01T09:00:00Z' },
    ];
    const mockLocations = [
      {
        id: 'location-1',
        technician_id: 'tech-1',
        timestamp: '2023-01-01T08:00:00Z',
      },
    ];

    mockSupabaseFrom.limit.mockResolvedValueOnce({
      data: [{ id: userId, role: 'dispatcher' }],
      error: null,
    } as never);
    mockSupabaseFrom.order
      .mockResolvedValueOnce({ data: mockTasks, error: null } as never)
      .mockResolvedValueOnce({ data: mockReports, error: null } as never)
      .mockResolvedValueOnce({ data: mockLocations, error: null } as never);

    const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tasks).toEqual(mockTasks);
    expect(data.data.reports).toEqual(mockReports);
    expect(data.data.locations).toEqual(mockLocations);
  });
});
