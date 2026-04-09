import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const describeNativeOnly =
  process.env.EXPO_NATIVE_TESTS === '1' ? describe : describe.skip;

describeNativeOnly('SyncEngine integration', () => {
  let testDb: SQLiteDatabase;
  let dbModule: typeof import('@/lib/db/local-database');
  let taskRepository: typeof import('@/lib/db/task-repository').taskRepository;
  let reportRepository: typeof import('@/lib/db/report-repository').reportRepository;
  let SyncEngine: typeof import('@/lib/sync/sync-engine').SyncEngine;
  let supabase: typeof import('@/lib/supabase').supabase;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    dbModule = await import('@/lib/db/local-database');
    testDb = await dbModule.getTestDatabase();
    vi.spyOn(dbModule, 'getDatabase').mockReturnValue(testDb);

    ({ taskRepository } = await import('@/lib/db/task-repository'));
    ({ reportRepository } = await import('@/lib/db/report-repository'));
    ({ SyncEngine } = await import('@/lib/sync/sync-engine'));
    ({ supabase } = await import('@/lib/supabase'));
    vi.stubGlobal('fetch', vi.fn());

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'integration-token',
        },
      },
    } as never);
  });

  afterEach(async () => {
    await testDb.closeAsync();
    vi.restoreAllMocks();
  });

  it('pushes queued local entities to the API and then pulls fresh server state into SQLite', async () => {
    const localTask = await taskRepository.create({
      id: '6a8899b2-f76d-4bf9-a65b-e4d9b0dd0f01',
      title: 'Offline task',
      description: 'Created offline',
      address: 'Offline Street 1',
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2026-04-09',
      customer_name: 'Offline Customer',
      customer_phone: '123456789',
      estimated_time: 60,
      technician_id: 'tech-1',
    });
    const localReport = await reportRepository.create({
      id: 'c25bd75c-3fe5-4c6c-a4a6-96c477487a11',
      task_id: localTask.id,
      status: 'completed',
      photos: ['file:///photo.jpg'],
      form_data: {
        summary: 'Completed offline',
      },
      signature: 'file:///signature.png',
      pdf_url: 'file:///report.pdf',
    });
    const queueItems = await testDb.getAllAsync<{ id: string; entity_id: string }>(
      'SELECT id, entity_id FROM sync_queue ORDER BY created_at ASC'
    );

    vi.mocked(global.fetch).mockImplementation(async input => {
      const url = String(input);

      if (url.includes('/api/sync/push')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            results: {
              itemResults: [
                {
                  id: queueItems[0]?.id,
                  status: 'success',
                  record: {
                    ...localTask,
                  },
                },
                {
                  id: queueItems[1]?.id,
                  status: 'success',
                  record: {
                    ...localReport,
                  },
                },
              ],
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            tasks: [
              {
                id: 'd03fea2f-482b-4727-a5df-7c20d931fe22',
                title: 'Pulled task',
                description: 'Arrived from server',
                address: 'Remote Street 2',
                latitude: 50.08,
                longitude: 14.43,
                status: 'assigned',
                priority: 'high',
                category: 'inspection',
                due_date: '2026-04-10',
                customer_name: 'Server Customer',
                customer_phone: '987654321',
                estimated_time: 45,
                technician_id: 'tech-1',
                created_at: '2026-04-09T08:00:00.000Z',
                updated_at: '2026-04-09T08:00:00.000Z',
                deleted_at: null,
                version: 1,
              },
            ],
            reports: [],
            locations: [],
            serverTimestamp: '2026-04-09T09:00:00.000Z',
          },
        }),
      } as Response;
    });

    const engine = new SyncEngine();
    const result = await engine.fullSync();

    expect(result.pushed.success).toBe(2);
    expect(result.pushed.failed).toBe(0);
    expect(result.pulled.tasks).toBe(1);

    const queuedItems = await testDb.getAllAsync<{ status: string }>(
      'SELECT status FROM sync_queue'
    );
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.every(item => item.status === 'synced')).toBe(true);

    const syncedTask = await taskRepository.getById(localTask.id, {
      includeDeleted: true,
    });
    const syncedReport = await reportRepository.getById(localReport.id, {
      includeDeleted: true,
    });
    const pulledTask = await taskRepository.getById(
      'd03fea2f-482b-4727-a5df-7c20d931fe22'
    );

    expect(syncedTask?.synced).toBe(1);
    expect(syncedReport?.synced).toBe(1);
    expect(pulledTask?.title).toBe('Pulled task');
    expect(await taskRepository.getLastSyncTimestamp()).toBe(
      '2026-04-09T09:00:00.000Z'
    );
  });

  it('records a sync conflict when the server pulls a newer version over a pending local update', async () => {
    const localTask = await taskRepository.create({
      id: '9fd3bf84-53cb-48da-af0b-e498f2955999',
      title: 'Needs conflict',
      description: 'Initial value',
      address: 'Conflict Street 5',
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2026-04-09',
      customer_name: 'Conflict Customer',
      customer_phone: '123123123',
      estimated_time: 30,
      technician_id: 'tech-1',
    });

    await taskRepository.update(localTask.id, {
      description: 'Changed locally while offline',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tasks: [
            {
              ...localTask,
              description: 'Changed on server',
              updated_at: '2026-04-09T12:00:00.000Z',
              version: 3,
            },
          ],
          reports: [],
          locations: [],
          serverTimestamp: '2026-04-09T12:00:00.000Z',
        },
      }),
    } as Response);

    const engine = new SyncEngine();
    const result = await engine.pullSync();

    expect(result.tasks).toBe(1);

    const localRow = await taskRepository.getById(localTask.id, {
      includeDeleted: true,
    });
    const conflicts = await testDb.getAllAsync<{
      entity_type: string;
      entity_id: string;
      resolution: string;
    }>('SELECT entity_type, entity_id, resolution FROM sync_conflicts');

    expect(localRow?.description).toBe('Changed on server');
    expect(localRow?.version).toBe(3);
    expect(conflicts).toEqual([
      {
        entity_type: 'task',
        entity_id: localTask.id,
        resolution: 'server_wins',
      },
    ]);
  });
});
