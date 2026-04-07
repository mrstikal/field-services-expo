import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '../route';
import { NextRequest } from 'next/server';

// Mock cookies for SSR client
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
  })),
}));

// Mock supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'task-1', title: 'Updated Task' }, error: null }),
    })),
  })),
}));

describe('Task Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (id: string, body: unknown) => {
    return {
      nextUrl: {
        pathname: `/api/tasks/${id}`,
      },
      json: async () => body,
    } as unknown as NextRequest;
  };

  it('should update a task', async () => {
    const updateData = { title: 'Updated Task' };
    const req = createRequest('task-1', updateData);
    
    const response = await PATCH(req);
    const data = await (response as { json: () => Promise<{ id: string; title: string }> }).json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('task-1');
    expect(data.title).toBe('Updated Task');
  });

  it('should return 400 if ID is missing', async () => {
     const req = {
      nextUrl: {
        pathname: '/api/tasks/',
      },
      json: async () => ({}),
    } as unknown as NextRequest;

    const response = await PATCH(req);
    await (response as { json: () => Promise<unknown> }).json();

    expect(response.status).toBe(400);
  });
});
