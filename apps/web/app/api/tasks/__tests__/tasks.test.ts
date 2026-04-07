import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
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
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-task-1', title: 'Test Task' }, error: null }),
    })),
  })),
}));

describe('Tasks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: unknown) => {
    return {
      json: async () => body,
    } as unknown as NextRequest;
  };

  it('should create a new task', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      address: 'Test Address',
    };

    const req = createRequest(taskData);
    const response = await POST(req);
    const data = await (response as { json: () => Promise<{ id: string }> }).json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('new-task-1');
  });

  it('should return 400 if required fields are missing', async () => {
    const taskData = { title: 'Test Task' }; // Missing description and address

    const req = createRequest(taskData);
    const response = await POST(req);
    const data = await (response as { json: () => Promise<{ error: string }> }).json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });
});
