import { POST } from '@/app/api/sync/pull/route';
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { mockSupabaseAuth, mockSupabaseClient } from '@/vitest.setup';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
      headers: options?.headers ?? {},
    })),
  },
}));

vi.mock('@/lib/api-rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
}));

describe('Pull Sync API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
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

  it('should return 401 when bearer token is missing', async () => {
    const req = {
      headers: {
        get: () => null,
      },
      json: async () => ({ lastSyncTimestamp: '2026-04-09T00:00:00.000Z' }),
    } as unknown as NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockSupabaseAuth.getUser).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header is not bearer', async () => {
    const req = {
      headers: {
        get: (name: string) =>
          name === 'authorization' ? 'Basic abc123' : null,
      },
      json: async () => ({ lastSyncTimestamp: '2026-04-09T00:00:00.000Z' }),
    } as unknown as NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockSupabaseAuth.getUser).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

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

  it('should return 500 when user role lookup fails', async () => {
    const userId = '38383838-3838-4383-8383-383838383838';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('users lookup failed'),
      }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ lastSyncTimestamp: '2026-04-09T00:00:00.000Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unable to pull sync changes.');
  });

  it('should return 400 if lastSyncTimestamp is missing', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);

    const req = createRequest({});
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync pull payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid lastSyncTimestamp format', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: '33333333-3333-4333-8333-333333333333' } },
      error: null,
    } as never);

    const req = createRequest({ lastSyncTimestamp: 'not-a-date' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync pull payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when lastSyncTimestamp is null', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: '43434343-4343-4434-8434-434343434343' } },
      error: null,
    } as never);

    const req = createRequest({ lastSyncTimestamp: null });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync pull payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when lastSyncTimestamp is number', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: '45454545-4545-4454-8454-454545454545' } },
      error: null,
    } as never);

    const req = createRequest({ lastSyncTimestamp: 12345 });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync pull payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when lastSyncTimestamp has no timezone offset', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: '47474747-4747-4474-8474-474747474747' } },
      error: null,
    } as never);

    const req = createRequest({ lastSyncTimestamp: '2026-04-09T10:00:00' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync pull payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 429 before payload validation when rate limited', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: '37373737-3737-4373-8373-373737373737' } },
      error: null,
    } as never);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      retryAfterSeconds: 11,
    });

    const req = createRequest({ lastSyncTimestamp: 'not-a-date' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many sync pull requests.');
    expect(response.headers['Retry-After']).toBe('11');
  });

  it('should fetch changes since last sync for dispatcher', async () => {
    const userId = '17171717-1717-4717-8717-171717171717';
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

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role: 'dispatcher' },
        error: null,
      }),
    };
    const tasksQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
    };
    const reportsQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
    };
    const locationsQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockLocations, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return tasksQuery as never;
      if (table === 'reports') return reportsQuery as never;
      if (table === 'locations') return locationsQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tasks).toEqual(mockTasks);
    expect(data.data.reports).toEqual(mockReports);
    expect(data.data.locations).toEqual(mockLocations);
  });

  it('should scope pull data to technician ownership', async () => {
    const userId = '18181818-1818-4818-8818-181818181818';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const mockTasks = [
      {
        id: '19191919-1919-4919-8919-191919191919',
        technician_id: userId,
        updated_at: '2023-01-01T10:00:00Z',
      },
    ];
    const mockReports = [
      {
        id: '20202020-2020-4020-8020-202020202020',
        task_id: '19191919-1919-4919-8919-191919191919',
        updated_at: '2023-01-01T10:30:00Z',
      },
    ];
    const mockLocations = [
      {
        id: '21212121-2121-4121-8121-212121212121',
        technician_id: userId,
        timestamp: '2023-01-01T09:00:00Z',
      },
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role: 'technician' },
        error: null,
      }),
    };
    const tasksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
    };
    const reportsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
    };
    const locationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockLocations, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return tasksQuery as never;
      if (table === 'reports') return reportsQuery as never;
      if (table === 'locations') return locationsQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(tasksQuery.eq).toHaveBeenCalledWith('technician_id', userId);
    expect(locationsQuery.eq).toHaveBeenCalledWith('technician_id', userId);
    expect(reportsQuery.in).toHaveBeenCalledWith('task_id', [
      '19191919-1919-4919-8919-191919191919',
    ]);
    expect(data.data.tasks).toEqual(mockTasks);
    expect(data.data.reports).toEqual(mockReports);
    expect(data.data.locations).toEqual(mockLocations);
  });

  it('should return 429 when pull rate limit is exceeded', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } },
      error: null,
    } as never);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      retryAfterSeconds: 17,
    });

    const req = createRequest({ lastSyncTimestamp: '2026-04-09T00:00:00.000Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many sync pull requests.');
    expect(response.headers['Retry-After']).toBe('17');
  });

  it('should return empty reports for technician when no owned tasks are found', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role: 'technician' },
        error: null,
      }),
    };
    const tasksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const reportsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const locationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return tasksQuery as never;
      if (table === 'reports') return reportsQuery as never;
      if (table === 'locations') return locationsQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tasks).toEqual([]);
    expect(data.data.reports).toEqual([]);
    expect(data.data.locations).toEqual([]);
    expect(reportsQuery.in).not.toHaveBeenCalled();
  });

  it('should fallback unknown role to technician scope', async () => {
    const userId = '23232323-2323-4232-8232-232323232323';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role: 'unknown-role' },
        error: null,
      }),
    };
    const tasksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const reportsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const locationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return tasksQuery as never;
      if (table === 'reports') return reportsQuery as never;
      if (table === 'locations') return locationsQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(tasksQuery.eq).toHaveBeenCalledWith('technician_id', userId);
    expect(locationsQuery.eq).toHaveBeenCalledWith('technician_id', userId);
    expect(data.data.tasks).toEqual([]);
    expect(data.data.reports).toEqual([]);
    expect(data.data.locations).toEqual([]);
  });
});
