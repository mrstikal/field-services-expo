import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { mockSupabaseAuth, mockSupabaseClient } from '@/vitest.setup';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

describe('Push Sync API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: unknown, token = 'test-token') => {
    return {
      headers: {
        get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
      },
      json: async () => body,
    } as unknown as NextRequest;
  };

  it('should process successful changes', async () => {
    const userId = 'user-1';
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null } as never);

    const changes = [
      { id: 'q-1', type: 'task', action: 'create', data: { id: 'task-1', title: 'New Task' }, version: 1 }
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: userId, role: 'dispatcher' }], error: null }),
    };
    const taskUpsertQuery = {
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const syncQueueQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from.mockImplementation((((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return taskUpsertQuery as never;
      if (table === 'sync_queue') return syncQueueQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown) as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results.success).toBe(1);
  });

  it('should detect version conflicts', async () => {
    const userId = 'user-1';
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null } as never);

    const changes = [
      { id: 'q-1', type: 'task', action: 'update', data: { id: 'task-1', title: 'Stale Task' }, version: 3 } // Client has version 3
    ];

    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: userId, role: 'dispatcher' }], error: null }),
    };
    const taskVersionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ version: 5 }], error: null }),
    };

    mockSupabaseClient.from.mockImplementation((((table: string) => {
      if (table === 'users') return userQuery as never;
      if (table === 'tasks') return taskVersionQuery as never;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown) as never);

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.conflicts).toHaveLength(1);
    expect(data.results.success).toBe(0);
  });
});
