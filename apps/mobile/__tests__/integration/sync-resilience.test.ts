import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from '@/lib/sync/sync-engine';
import {
  getTestDatabase,
  closeDatabase,
  getDatabase,
} from '@/lib/db/local-database';
import { taskRepository } from '@/lib/db/task-repository';

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('Mobile Sync Resilience Tests', () => {
  let syncEngine: SyncEngine;
  let db: ReturnType<typeof getDatabase>;

  beforeEach(async () => {
    db = await getTestDatabase();
    syncEngine = SyncEngine.getInstance();
    vi.mocked(global.fetch).mockReset();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should mark items as failed on server validation error', async () => {
    const newTask = await taskRepository.create({
      title: 'Task for fail',
      description: '...',
      address: '...',
      latitude: 0,
      longitude: 0,
      status: 'assigned' as any,
      priority: 'low' as any,
      category: 'repair' as any,
      due_date: '2024-01-01',
      customer_name: '...',
      customer_phone: '...',
      estimated_time: 1,
      technician_id: 'tech-1',
    });

    // Mock fetch to return success=true, but failed item
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            itemResults: [
              {
                id: newTask.id,
                status: 'failed',
                error: 'Database constraint failed',
              },
            ],
          },
        }),
      })
    );

    const result = await syncEngine.pushSync();

    const syncItem = await db.getFirstAsync<{
      status: string;
      error: string | null;
    }>(`SELECT status, error FROM sync_queue WHERE id = ?`, [newTask.id]);

    expect(syncItem?.status).toBe('failed');
    expect(syncItem?.error).toBe('Database constraint failed');
    expect(result.failed).toBe(1);
  });

  it('should handle duplicate ID conflict', async () => {
    const newTask = await taskRepository.create({
      title: 'Duplicate Task',
      description: '...',
      address: '...',
      latitude: 0,
      longitude: 0,
      status: 'assigned' as any,
      priority: 'low' as any,
      category: 'repair' as any,
      due_date: '2024-01-01',
      customer_name: '...',
      customer_phone: '...',
      estimated_time: 1,
      technician_id: 'tech-1',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            itemResults: [
              {
                id: newTask.id,
                status: 'failed',
                error: 'Conflict: ID already exists',
              },
            ],
          },
        }),
      })
    );

    await syncEngine.pushSync();

    const syncItem = await db.getFirstAsync<{ status: string }>(
      `SELECT status FROM sync_queue WHERE id = ?`,
      [newTask.id]
    );
    expect(syncItem?.status).toBe('failed');
  });
});
