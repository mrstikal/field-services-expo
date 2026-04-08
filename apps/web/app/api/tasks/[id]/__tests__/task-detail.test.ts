import { GET, PUT, PATCH, DELETE } from '@/app/api/tasks/[id]/route';
import { NextRequest } from 'next/server';

// Mock cookies for SSR client
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
  })),
}));

// Shared mock factory
const mockFrom = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('Task Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (id: string, body?: unknown) => {
    return {
      nextUrl: { pathname: `/api/tasks/${id}` },
      json: async () => body ?? {},
    } as unknown as NextRequest;
  };

  // ─── GET ────────────────────────────────────────────────────────────────────

  describe('GET /api/tasks/[id]', () => {
    it('should return a task by id', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({
            data: { id: 'task-1', title: 'Found Task' },
            error: null,
          }),
      });

      const req = createRequest('task-1');
      const response = await GET(req, { params: { id: 'task-1' } });
      const data = await (
        response as { json: () => Promise<{ id: string; title: string }> }
      ).json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('task-1');
      expect(data.title).toBe('Found Task');
    });

    it('should return 404 when task is not found (PGRST116)', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Row not found', code: 'PGRST116' },
        }),
      });

      const req = createRequest('nonexistent-id');
      const response = await GET(req, { params: { id: 'nonexistent-id' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Row not found');
    });

    it('should return 400 when id is empty', async () => {
      const req = createRequest('');
      const response = await GET(req, { params: { id: '' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 on generic database error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error', code: 'OTHER' },
        }),
      });

      const req = createRequest('task-1');
      const response = await GET(req, { params: { id: 'task-1' } });

      expect(response.status).toBe(400);
    });
  });

  // ─── PUT ────────────────────────────────────────────────────────────────────

  describe('PUT /api/tasks/[id]', () => {
    it('should update a task', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({
            data: { id: 'task-1', title: 'Updated Task' },
            error: null,
          }),
      });

      const req = createRequest('task-1', { title: 'Updated Task' });
      const response = await PUT(req, { params: { id: 'task-1' } });
      const data = await (
        response as { json: () => Promise<{ id: string; title: string }> }
      ).json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('task-1');
      expect(data.title).toBe('Updated Task');
    });

    it('should return 400 when id is empty', async () => {
      const req = createRequest('', { title: 'Updated Task' });
      const response = await PUT(req, { params: { id: '' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 404 when task not found after update', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const req = createRequest('task-1', { title: 'Updated Task' });
      const response = await PUT(req, { params: { id: 'task-1' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 400 on database update error', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({
            data: null,
            error: { message: 'Update failed' },
          }),
      });

      const req = createRequest('task-1', { title: 'Updated Task' });
      const response = await PUT(req, { params: { id: 'task-1' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Update failed');
    });
  });

  // ─── PATCH ──────────────────────────────────────────────────────────────────

  describe('PATCH /api/tasks/[id]', () => {
    it('should update a task (delegates to PUT)', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({
            data: { id: 'task-1', title: 'Updated Task' },
            error: null,
          }),
      });

      const req = createRequest('task-1', { title: 'Updated Task' });
      const response = await PATCH(req, { params: { id: 'task-1' } });
      const data = await (
        response as { json: () => Promise<{ id: string; title: string }> }
      ).json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('task-1');
    });

    it('should return 400 if ID is missing', async () => {
      const req = createRequest('', {});
      const response = await PATCH(req, { params: { id: '' } });

      expect(response.status).toBe(400);
    });
  });

  // ─── DELETE ─────────────────────────────────────────────────────────────────

  describe('DELETE /api/tasks/[id]', () => {
    it('should delete a task and return 204', async () => {
      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const req = createRequest('task-1');
      const response = await DELETE(req, { params: { id: 'task-1' } });

      expect(response.status).toBe(204);
    });

    it('should return 400 when id is empty', async () => {
      const req = createRequest('');
      const response = await DELETE(req, { params: { id: '' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 on database delete error', async () => {
      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      });

      const req = createRequest('task-1');
      const response = await DELETE(req, { params: { id: 'task-1' } });
      const data = await (
        response as { json: () => Promise<{ error: string }> }
      ).json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Delete failed');
    });
  });
});
