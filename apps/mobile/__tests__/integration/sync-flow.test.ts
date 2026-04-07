import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../../lib/sync/sync-engine';
import { taskRepository } from '../../lib/db/task-repository';
import { supabase } from '../../lib/supabase';
import { getDatabase } from '../../lib/db/local-database';

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

// Mock local database
vi.mock('../../lib/db/local-database', () => ({
  getDatabase: vi.fn(),
}));

// Mock repositories
vi.mock('../../lib/db/task-repository', () => ({
  taskRepository: {
    getLastSyncTimestamp: vi.fn(),
    setLastSyncTimestamp: vi.fn(),
    upsertFromServer: vi.fn(),
  },
}));

vi.mock('../../lib/db/report-repository', () => ({
  reportRepository: {
    upsertFromServer: vi.fn(),
  },
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Mobile Sync Integration Flow', () => {
  let syncEngine: SyncEngine;
  const mockDb = {
    getAllAsync: vi.fn(),
    runAsync: vi.fn(),
    getFirstAsync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    syncEngine = SyncEngine.getInstance();
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    } as any);
  });

  it('should perform pull sync successfully', async () => {
    const mockTasks = [{ id: 'task-1', title: 'Task 1' }];
    const mockReports = [{ id: 'report-1', title: 'Report 1' }];
    
    vi.mocked(taskRepository.getLastSyncTimestamp).mockResolvedValue('1970-01-01T00:00:00.000Z');
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tasks: mockTasks,
          reports: mockReports,
          locations: [],
          serverTimestamp: '2023-01-01T12:00:00Z',
        },
      }),
    } as any);

    const result = await syncEngine.pullSync();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sync/pull'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ lastSyncTimestamp: '1970-01-01T00:00:00.000Z' }),
      })
    );

    expect(taskRepository.upsertFromServer).toHaveBeenCalledWith(mockTasks[0]);
    expect(taskRepository.setLastSyncTimestamp).toHaveBeenCalledWith('2023-01-01T12:00:00Z');
    expect(result.tasks).toBe(1);
    expect(result.reports).toBe(1);
  });

  it('should push local changes to server', async () => {
    const mockQueueItems = [
      {
        id: 'queue-1',
        type: 'task',
        action: 'create',
        data: JSON.stringify({ title: 'New Task' }),
        version: 1,
      },
    ];

    mockDb.getAllAsync.mockResolvedValue(mockQueueItems);
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [
            { id: 'queue-1', status: 'success' },
          ],
        },
      }),
    } as any);

    const result = await syncEngine.pushSync();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sync/push'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('New Task'),
      })
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_queue SET status = ?'),
      expect.arrayContaining(['synced', expect.any(String), 'queue-1'])
    );
    
    expect(result.success).toBe(1);
  });

  it('should handle sync failure and mark as failed', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 'queue-1', type: 'task', action: 'create', data: '{}', version: 1 },
    ]);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, // API call success, but item might fail
        results: {
          itemResults: [
            { id: 'queue-1', status: 'failed', error: 'Server validation error' },
          ],
        },
      }),
    } as any);

    const result = await syncEngine.pushSync();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('status = ?, error = ?'),
      expect.arrayContaining(['failed', 'Server validation error'])
    );
    expect(result.failed).toBe(1);
    expect(result.errors).toContain('Server validation error');
  });
});
