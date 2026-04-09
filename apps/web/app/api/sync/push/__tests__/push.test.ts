import { POST } from '@/app/api/sync/push/route';
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/api-rate-limit';
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
      headers: options?.headers ?? {},
    })),
  },
}));

vi.mock('@/lib/api-rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
}));

describe('Push Sync API', () => {
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
      json: async () => ({ changes: [] }),
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
      json: async () => ({ changes: [] }),
    } as unknown as NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockSupabaseAuth.getUser).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('should return 500 when user role lookup fails', async () => {
    const userId = '39393939-3939-4393-8393-393939393939';
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

    const req = createRequest({
      changes: [
        {
          id: '40404040-4040-4404-8404-404040404040',
          type: 'task',
          action: 'create',
          entityId: '41414141-4141-4414-8414-414141414141',
          data: {},
          version: 1,
        },
      ],
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unable to push sync changes.');
  });

  it('should return 400 for invalid push payload', async () => {
    const userId = '31313131-3131-4313-8313-313131313131';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({ changes: [] });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when changes field is missing', async () => {
    const userId = '42424242-4242-4424-8424-424242424242';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({});
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when changes is null', async () => {
    const userId = '44444444-4444-4444-8444-444444444444';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({ changes: null });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when changes is not an array', async () => {
    const userId = '46464646-4646-4464-8464-464646464646';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({ changes: 123 });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when change is missing entityId', async () => {
    const userId = '34343434-3434-4343-8343-343434343434';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({
      changes: [
        {
          id: '35353535-3535-4353-8353-353535353535',
          type: 'task',
          action: 'create',
          data: {},
          version: 1,
        },
      ],
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when change id is not a uuid', async () => {
    const userId = '48484848-4848-4484-8484-484848484848';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({
      changes: [
        {
          id: 'not-a-uuid',
          type: 'task',
          action: 'create',
          entityId: '49494949-4949-4494-8494-494949494949',
          data: {},
          version: 1,
        },
      ],
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when entityId is not a uuid', async () => {
    const userId = '50505050-5050-4505-8505-505050505050';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({
      changes: [
        {
          id: '51515151-5151-4515-8515-515151515151',
          type: 'task',
          action: 'create',
          entityId: 'not-a-uuid',
          data: {},
          version: 1,
        },
      ],
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when change type is invalid', async () => {
    const userId = '52525252-5252-4525-8525-525252525252';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const req = createRequest({
      changes: [
        {
          id: '53535353-5353-4535-8535-535353535353',
          type: 'invalid-type',
          action: 'create',
          entityId: '54545454-5454-4545-8545-545454545454',
          data: {},
          version: 1,
        },
      ],
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sync push payload.');
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 429 before payload validation when rate limited', async () => {
    const userId = '36363636-3636-4363-8363-363636363636';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      retryAfterSeconds: 9,
    });

    const req = createRequest({ changes: [] });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many sync push requests.');
    expect(response.headers['Retry-After']).toBe('9');
  });

  it('should process successful changes', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const changes = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'task',
        action: 'create',
        entityId: '22222222-2222-4222-8222-222222222222',
        data: {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'New Task',
          description: 'Test task description',
          address: 'Main street 1',
          latitude: 50.1,
          longitude: 14.4,
          status: 'assigned',
          priority: 'medium',
          category: 'repair',
          due_date: '2026-04-09T10:00:00.000Z',
          customer_name: 'Customer',
          customer_phone: '+420123456789',
          estimated_time: 60,
          technician_id: userId,
          created_at: '2026-04-09T09:00:00.000Z',
          updated_at: '2026-04-09T09:00:00.000Z',
          version: 1,
          deleted_at: null,
        },
        version: 1,
      },
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: { id: userId, role: 'dispatcher' },
          error: null,
        }),
    };
    const taskUpsertQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: {
            id: '22222222-2222-4222-8222-222222222222',
            version: 1,
          },
          error: null,
        }),
    };
    const syncQueueQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return taskUpsertQuery as never;
      if (table === 'sync_queue') return syncQueueQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results.success).toBe(1);
  });

  it('should detect version conflicts', async () => {
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const changes = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        type: 'task',
        action: 'update',
        entityId: '44444444-4444-4444-8444-444444444444',
        data: {
          id: '44444444-4444-4444-8444-444444444444',
          title: 'Stale Task',
          description: 'Task description',
          address: 'Main street 2',
          latitude: 50.2,
          longitude: 14.5,
          status: 'assigned',
          priority: 'medium',
          category: 'repair',
          due_date: '2026-04-09T10:00:00.000Z',
          customer_name: 'Customer',
          customer_phone: '+420123456789',
          estimated_time: 30,
          technician_id: userId,
          created_at: '2026-04-09T09:00:00.000Z',
          updated_at: '2026-04-09T09:30:00.000Z',
          version: 3,
          deleted_at: null,
        },
        version: 3,
      }, // Client has version 3
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: { id: userId, role: 'dispatcher' },
          error: null,
        }),
    };
    const taskVersionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: { version: 5, technician_id: userId },
          error: null,
        }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return taskVersionQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.conflicts).toHaveLength(1);
    expect(data.results.success).toBe(0);
  });

  it('should block technician from pushing location for another technician', async () => {
    const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const changes = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        type: 'location',
        action: 'create',
        entityId: '66666666-6666-4666-8666-666666666666',
        data: {
          id: '66666666-6666-4666-8666-666666666666',
          technician_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          latitude: 50.1,
          longitude: 14.4,
          accuracy: 10,
          timestamp: '2026-04-09T00:00:00.000Z',
          created_at: '2026-04-09T00:00:00.000Z',
        },
        version: 1,
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
    const locationQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'locations') return locationQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.failed).toBe(1);
    expect(data.results.itemResults[0]?.status).toBe('failed');
    expect(data.results.itemResults[0]?.error).toContain('Forbidden');
    expect(locationQuery.upsert).not.toHaveBeenCalled();
  });

  it('should return 429 when push rate limit is exceeded', async () => {
    const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      retryAfterSeconds: 23,
    });

    const req = createRequest({ changes: [] });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many sync push requests.');
    expect(response.headers['Retry-After']).toBe('23');
  });

  it('should block technician from updating task owned by another technician', async () => {
    const userId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const changes = [
      {
        id: '77777777-7777-4777-8777-777777777777',
        type: 'task',
        action: 'update',
        entityId: '88888888-8888-4888-8888-888888888888',
        data: {
          id: '88888888-8888-4888-8888-888888888888',
          title: 'Unauthorized update',
          description: 'Task description',
          address: 'Main street 3',
          latitude: 50.3,
          longitude: 14.6,
          status: 'assigned',
          priority: 'medium',
          category: 'repair',
          due_date: '2026-04-09T10:00:00.000Z',
          customer_name: 'Customer',
          customer_phone: '+420123456789',
          estimated_time: 45,
          technician_id: '99999999-9999-4999-8999-999999999999',
          created_at: '2026-04-09T09:00:00.000Z',
          updated_at: '2026-04-09T09:45:00.000Z',
          version: 1,
          deleted_at: null,
        },
        version: 1,
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
    const taskQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: '88888888-8888-4888-8888-888888888888',
          technician_id: '99999999-9999-4999-8999-999999999999',
          version: 1,
        },
        error: null,
      }),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return taskQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.failed).toBe(1);
    expect(data.results.itemResults[0]?.status).toBe('failed');
    expect(data.results.itemResults[0]?.error).toContain('Forbidden');
    expect(taskQuery.upsert).not.toHaveBeenCalled();
  });

  it('should block technician from creating report for task owned by another technician', async () => {
    const userId = '12121212-1212-4212-8212-121212121212';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const now = '2026-04-09T10:00:00.000Z';
    const changes = [
      {
        id: '13131313-1313-4313-8313-131313131313',
        type: 'report',
        action: 'create',
        entityId: '14141414-1414-4414-8414-141414141414',
        data: {
          id: '14141414-1414-4414-8414-141414141414',
          task_id: '15151515-1515-4515-8515-151515151515',
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
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role: 'technician' },
        error: null,
      }),
    };
    const reportQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const taskOwnershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { technician_id: '16161616-1616-4616-8616-161616161616' },
        error: null,
      }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'reports') return reportQuery as never;
      if (table === 'tasks') return taskOwnershipQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.failed).toBe(1);
    expect(data.results.itemResults[0]?.status).toBe('failed');
    expect(data.results.itemResults[0]?.error).toContain('Forbidden');
    expect(reportQuery.upsert).not.toHaveBeenCalled();
  });

  it('should fallback unknown role to technician permissions in push', async () => {
    const userId = '24242424-2424-4242-8242-242424242424';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const changes = [
      {
        id: '25252525-2525-4252-8252-252525252525',
        type: 'location',
        action: 'create',
        entityId: '26262626-2626-4262-8262-262626262626',
        data: {
          id: '26262626-2626-4262-8262-262626262626',
          technician_id: '27272727-2727-4272-8272-272727272727',
          latitude: 50.1,
          longitude: 14.4,
          accuracy: 10,
          timestamp: '2026-04-09T00:00:00.000Z',
          created_at: '2026-04-09T00:00:00.000Z',
        },
        version: 1,
      },
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role: 'unknown-role' },
        error: null,
      }),
    };
    const locationQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'locations') return locationQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.failed).toBe(1);
    expect(data.results.itemResults[0]?.status).toBe('failed');
    expect(data.results.itemResults[0]?.error).toContain('Forbidden');
    expect(locationQuery.upsert).not.toHaveBeenCalled();
  });

  it('should block technician report delete when report ownership cannot be resolved', async () => {
    const userId = '28282828-2828-4282-8282-282828282828';
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const changes = [
      {
        id: '29292929-2929-4292-8292-292929292929',
        type: 'report',
        action: 'delete',
        entityId: '30303030-3030-4030-8030-303030303030',
        data: {
          id: '30303030-3030-4030-8030-303030303030',
          deleted_at: '2026-04-09T10:00:00.000Z',
          updated_at: '2026-04-09T10:00:00.000Z',
          version: 2,
        },
        version: 2,
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
    const reportQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from.mockImplementation(((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'reports') return reportQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.failed).toBe(1);
    expect(data.results.itemResults[0]?.status).toBe('failed');
    expect(data.results.itemResults[0]?.error).toContain('Forbidden');
    expect(reportQuery.update).not.toHaveBeenCalled();
  });
});
