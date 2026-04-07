import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
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
    
    // First select for user check, second for count
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: userId }]),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      } as never);

    const req = createRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pendingItems).toBe(5);
  });
});
