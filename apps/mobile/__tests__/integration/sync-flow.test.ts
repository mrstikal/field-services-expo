import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from '@lib/sync/sync-engine';
import { TaskRepository } from '@lib/db/task-repository';
import { ReportRepository } from '@lib/db/report-repository';
import { supabase } from '@lib/supabase';
import { getTestDatabase, closeDatabase } from '@lib/db/local-database';
import { SQLiteDatabase } from 'expo-sqlite';

// Mock supabase
vi.mock('@lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

// Mock global fetch
global.fetch = vi.fn();

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('Mobile Sync Integration Flow', () => {
  let syncEngine: SyncEngine;
  let testDb: SQLiteDatabase;
  let taskRepository: TaskRepository;
  let reportRepository: ReportRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDb = await getTestDatabase();
    taskRepository = new TaskRepository(testDb);
    reportRepository = new ReportRepository(testDb);
    syncEngine = new SyncEngine();
    // Ensure initialized
    await syncEngine.initialize();

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    } as any);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should perform pull sync successfully', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'desc',
        address: 'addr',
        latitude: 0,
        longitude: 0,
        status: 'assigned',
        priority: 'low',
        category: 'repair',
        due_date: '2024-01-01',
        customer_name: 'cust',
        customer_phone: 'phone',
        estimated_time: 1,
        technician_id: 'tech1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1,
        synced: 0,
      },
    ];
    const mockReports = [
      {
        id: 'report-1',
        task_id: 'task-1',
        status: 'draft',
        photos: [],
        form_data: {},
        signature: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1,
        synced: 0,
      },
    ];

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

    const fetchedTask = await taskRepository.getById('task-1');
    expect(fetchedTask).toEqual(
      expect.objectContaining({ id: 'task-1', title: 'Task 1' })
    );
    const fetchedReport = await reportRepository.getById('report-1');
    expect(fetchedReport).toEqual(
      expect.objectContaining({ id: 'report-1', task_id: 'task-1' })
    );

    expect(await taskRepository.getLastSyncTimestamp()).toBe(
      '2023-01-01T12:00:00Z'
    );
    expect(result.tasks).toBe(1);
    expect(result.reports).toBe(1);
  });

  it('should push local changes to server', async () => {
    const newTask = await taskRepository.create({
      title: 'New Task',
      description: 'desc',
      address: 'addr',
      latitude: 0,
      longitude: 0,
      status: 'assigned',
      priority: 'low',
      category: 'repair',
      due_date: '2024-01-01',
      customer_name: 'cust',
      customer_phone: 'phone',
      estimated_time: 1,
      technician_id: 'tech1',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [{ id: expect.any(String), status: 'success' }],
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

    const syncQueueStatus = await testDb.getFirstAsync<{ status: string }>(
      `SELECT status FROM sync_queue WHERE id = ?`,
      [newTask.id]
    );
    expect(syncQueueStatus?.status).toBe('synced');

    expect(result.success).toBe(1);
  });

  it('should handle sync failure and mark as failed', async () => {
    const newTask = await taskRepository.create({
      title: 'New Task',
      description: 'desc',
      address: 'addr',
      latitude: 0,
      longitude: 0,
      status: 'assigned',
      priority: 'low',
      category: 'repair',
      due_date: '2024-01-01',
      customer_name: 'cust',
      customer_phone: 'phone',
      estimated_time: 1,
      technician_id: 'tech1',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, // API call success, but item might fail
        results: {
          itemResults: [
            {
              id: expect.any(String),
              status: 'failed',
              error: 'Server validation error',
            },
          ],
        },
      }),
    } as any);

    const result = await syncEngine.pushSync();

    const syncQueueItem = await testDb.getFirstAsync<{
      status: string;
      error: string;
    }>(`SELECT status, error FROM sync_queue WHERE id = ?`, [newTask.id]);
    expect(syncQueueItem?.status).toBe('failed');
    expect(syncQueueItem?.error).toContain('Server validation error');

    expect(result.failed).toBe(1);
    expect(result.errors).toContain('Server validation error');
  });
});
