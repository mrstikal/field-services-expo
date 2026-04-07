import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { db } from '@db';
import { mockSupabaseAuth } from '@/vitest.setup';

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
    
    // Mock user role
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: userId, role: 'dispatcher' }]),
    } as never);

    const changes = [
      { id: 'q-1', type: 'task', action: 'create', data: { id: 'task-1', title: 'New Task' }, version: 1 }
    ];

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue({}),
    } as never);

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    } as never);

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
    
    // First select for user role, second for local version
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: userId, role: 'dispatcher' }]),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ version: 5 }]), // Server has version 5
      } as never);

    const changes = [
      { id: 'q-1', type: 'task', action: 'update', data: { id: 'task-1', title: 'Stale Task' }, version: 3 } // Client has version 3
    ];

    const req = createRequest({ changes });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.conflicts).toHaveLength(1);
    expect(data.results.success).toBe(0);
  });
});
