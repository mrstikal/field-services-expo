import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

// Mock cookies for SSR client
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
  })),
}));

// Mock supabase/ssr
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
    },
    from: mockFrom,
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

  describe('GET /api/tasks', () => {
    it('should return all tasks', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task One' },
        { id: 'task-2', title: 'Task Two' },
      ];
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
      });

      const response = await GET();
      const data = await (response as { json: () => Promise<unknown> }).json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockTasks);
    });

    it('should return 500 when database error occurs', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      const response = await GET();
      const data = await (response as { json: () => Promise<{ error: string }> }).json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('DB error');
    });

    it('should return empty array when no tasks exist', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const response = await GET();
      const data = await (response as { json: () => Promise<unknown[]> }).json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'new-task-1', title: 'Test Task' }, error: null }),
      });

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

    it('should return 400 when database insert fails', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      });

      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        address: 'Test Address',
      };

      const req = createRequest(taskData);
      const response = await POST(req);
      const data = await (response as { json: () => Promise<{ error: string }> }).json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Insert failed');
    });
  });
});
