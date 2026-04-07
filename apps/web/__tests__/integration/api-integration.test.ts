import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as pullPOST } from '../../app/api/sync/pull/route';
import { POST as pushPOST } from '../../app/api/sync/push/route';
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

describe('Web Sync API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: unknown, token = 'test-token') => {
    const headers = new Map();
    headers.set('authorization', `Bearer ${token}`);
    
    return {
      headers: {
        get: (name: string) => headers.get(name.toLowerCase()) || null,
      },
      json: async () => body,
    } as unknown as NextRequest;
  };

  describe('Pull Sync API Workflow', () => {
    it('should sync tasks and reports for a technician since last timestamp', async () => {
      const techId = 'tech-1';
      mockSupabaseAuth.getUser.mockResolvedValue({ 
        data: { user: { id: techId, email: 'tech@test.com' } }, 
        error: null 
      } as never);
      
      // 1. Mock user role check
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: techId, role: 'technician' }]),
      } as never);

      // 2. Mock tasks retrieval
      const mockTasks = [{ id: 'task-1', technician_id: techId, updated_at: '2023-01-01T10:00:00Z' }];
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTasks),
      } as never);
      
      // 3. Mock reports retrieval
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]), // No reports for simplicity
      } as never);

      // 4. Mock locations retrieval
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      } as never);

      const req = createRequest({ lastSyncTimestamp: '2023-01-01T00:00:00Z' });
      const response = await pullPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tasks).toHaveLength(1);
      expect(data.data.tasks[0].id).toBe('task-1');
    });
  });

  describe('Push Sync API Workflow', () => {
    it('should process creates and updates from mobile client', async () => {
      const techId = 'tech-1';
      mockSupabaseAuth.getUser.mockResolvedValue({ 
        data: { user: { id: techId, email: 'tech@test.com' } }, 
        error: null 
      } as never);

      // 1. Mock user role check
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: techId, role: 'technician' }]),
      } as never);
      
      // Support nested calls in push (e.g. checkAuthorization, getLocalVersion, etc.)
      const mockSelect = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
          then: vi.fn((cb) => Promise.resolve([]).then(cb)), // Simple mock for promise-like
      };
      
      // technician check for reports
      vi.mocked(db.select).mockReturnValue(mockSelect as any);
      // Ensure we return data for auth check when querying tasks for technician
      mockSelect.then = vi.fn((cb) => {
          // If we are in checkAuthorization for technician + report create
          // it checks tasks for ownership
          return Promise.resolve([{ technician_id: techId }]).then(cb);
      });

      // Mock DB interactions for push
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      } as never);
      
      vi.mocked(db.update).mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({}),
      } as never);

      const pushData = {
        changes: [
          {
            id: 'client-uuid-1',
            type: 'task',
            action: 'create',
            data: { id: 'task-uuid', title: 'Local Task', description: 'desc', technician_id: techId, due_date: new Date().toISOString(), updated_at: new Date().toISOString() },
            version: 1
          },
          {
            id: 'client-uuid-2',
            type: 'report',
            action: 'create',
            data: { id: 'report-uuid', task_id: 'task-1', status: 'completed', updated_at: new Date().toISOString() },
            version: 1
          }
        ]
      };

      const req = createRequest(pushData);
      const response = await pushPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.itemResults).toHaveLength(2);
      expect(data.results.itemResults[0].status).toBe('success');
      expect(data.results.itemResults[1].status).toBe('success');
    });

    it('should handle unauthorized push requests', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never);
      const req = createRequest({ changes: [] });
      const response = await pushPOST(req);
      expect(response.status).toBe(401);
    });
  });
});
