import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { SyncAuthUnavailableError, SyncEngine } from '@lib/sync/sync-engine';
import { getDatabase } from '@/lib/db/local-database';
import { supabase } from '@/lib/supabase';
import { taskRepository } from '@/lib/db/task-repository';
import { reportRepository } from '@/lib/db/report-repository';
import { locationRepository } from '@/lib/db/location-repository';

vi.mock('@/lib/db/local-database', () => ({
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  resetDatabase: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/task-repository', () => ({
  taskRepository: {
    getLastSyncTimestamp: vi.fn(),
    setLastSyncTimestamp: vi.fn(),
    upsertFromServer: vi.fn(),
    getById: vi.fn(),
    resolveConflict: vi.fn(),
  },
}));

vi.mock('@/lib/db/report-repository', () => ({
  reportRepository: {
    upsertFromServer: vi.fn(),
    getById: vi.fn(),
    resolveConflict: vi.fn(),
  },
}));

vi.mock('@/lib/db/location-repository', () => ({
  locationRepository: {
    upsertFromServer: vi.fn(),
  },
}));

interface MockDb {
  runAsync: Mock;
  getAllAsync: Mock;
  getFirstAsync: Mock;
}

describe('SyncEngine', () => {
  let mockDb: MockDb;
  let engine: SyncEngine;

  beforeEach(() => {
    mockDb = {
      runAsync: vi.fn().mockResolvedValue(undefined),
      getAllAsync: vi.fn().mockResolvedValue([]),
      getFirstAsync: vi.fn().mockResolvedValue({ count: 0 }),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb as never);
    vi.mocked(taskRepository.getLastSyncTimestamp).mockResolvedValue(null);
    vi.mocked(taskRepository.setLastSyncTimestamp).mockResolvedValue(undefined);
    vi.mocked(taskRepository.upsertFromServer).mockResolvedValue({} as never);
    vi.mocked(taskRepository.getById).mockResolvedValue(null);
    vi.mocked(taskRepository.resolveConflict).mockResolvedValue({} as never);
    vi.mocked(reportRepository.upsertFromServer).mockResolvedValue({} as never);
    vi.mocked(reportRepository.getById).mockResolvedValue(null);
    vi.mocked(reportRepository.resolveConflict).mockResolvedValue({} as never);
    vi.mocked(locationRepository.upsertFromServer).mockResolvedValue(
      {} as never
    );

    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
        },
      },
    });

    global.fetch = vi.fn();
    engine = new SyncEngine();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pulls server changes and updates last sync timestamp', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tasks: [
            {
              id: 'task-1',
              updated_at: '2025-01-01T00:00:00.000Z',
              version: 1,
            },
          ],
          reports: [
            {
              id: 'report-1',
              updated_at: '2025-01-01T00:00:00.000Z',
              version: 1,
            },
          ],
          locations: [{ id: 'location-1' }],
          serverTimestamp: '2025-01-01T12:00:00.000Z',
        },
      }),
    } as Response);

    const result = await engine.pullSync();

    expect(result).toEqual({ tasks: 1, reports: 1, locations: 1 });
    expect(taskRepository.upsertFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' })
    );
    expect(reportRepository.upsertFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'report-1' })
    );
    expect(locationRepository.upsertFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'location-1' })
    );
    expect(taskRepository.setLastSyncTimestamp).toHaveBeenCalledWith(
      '2025-01-01T12:00:00.000Z'
    );
  });

  it('records conflicts during pull when pending local changes exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tasks: [
            {
              id: 'task-1',
              updated_at: '2025-01-01T00:00:00.000Z',
              version: 2,
            },
          ],
          reports: [],
          locations: [],
          serverTimestamp: '2025-01-01T12:00:00.000Z',
        },
      }),
    } as Response);

    vi.mocked(taskRepository.getById).mockResolvedValue({
      id: 'task-1',
    } as never);
    mockDb.getFirstAsync.mockResolvedValue({ count: 1 });

    await engine.pullSync();

    expect(taskRepository.resolveConflict).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
      expect.objectContaining({ id: 'task-1', version: 2 })
    );
    expect(taskRepository.upsertFromServer).not.toHaveBeenCalled();
  });

  it('surfaces HTTP pull failures with a stable fallback error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(engine.pullSync()).rejects.toThrow(
      'API request failed: 500 Internal Server Error'
    );
  });

  it('surfaces business pull failures with server error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Pull payload rejected by server',
      }),
    } as Response);

    await expect(engine.pullSync()).rejects.toThrow(
      'Pull payload rejected by server'
    );
  });

  it('pushes pending queue items and marks successful items as synced when no server record is returned', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'create',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1', title: 'Task 1' }),
        version: 1,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [{ id: 'queue-1', status: 'success' }],
        },
      }),
    } as Response);

    const result = await engine.pushSync();

    expect(result).toEqual({ success: 1, failed: 0, errors: [] });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      ['synced', null, expect.any(String), 'queue-1']
    );
  });

  it('marks failed push items as failed and returns errors', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'create',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 1,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [
            { id: 'queue-1', status: 'failed', error: 'Network error' },
          ],
        },
      }),
    } as Response);

    const result = await engine.pushSync();

    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(['Network error']);
  });

  it('surfaces business push failures with server error message', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'create',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 1,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Push payload rejected by server',
        results: { itemResults: [] },
      }),
    } as Response);

    await expect(engine.pushSync()).rejects.toThrow(
      'Push payload rejected by server'
    );
  });

  it('marks successful push item as synced when server record is returned', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'success',
              record: {
                id: 'task-1',
                updated_at: '2025-01-01T00:00:00.000Z',
                version: 2,
              },
            },
          ],
        },
      }),
    } as Response);

    await engine.pushSync();

    expect(taskRepository.upsertFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' })
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      ['synced', null, expect.any(String), 'queue-1']
    );
  });

  it('marks conflict item as synced after conflict resolution', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(taskRepository.getById).mockResolvedValue({
      id: 'task-1',
      version: 1,
    } as never);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'conflict',
              serverRecord: {
                id: 'task-1',
                updated_at: '2025-01-01T00:00:00.000Z',
                version: 2,
              },
            },
          ],
        },
      }),
    } as Response);

    await engine.pushSync();

    expect(taskRepository.resolveConflict).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
      expect.objectContaining({ id: 'task-1', version: 2 })
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      ['synced', null, expect.any(String), 'queue-1']
    );
  });

  it('marks conflict without server record as failed and counts it as failed result', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'conflict',
            },
          ],
        },
      }),
    } as Response);

    const result = await engine.pushSync();

    expect(result).toEqual({
      success: 0,
      failed: 1,
      errors: ['Conflict returned without a server record.'],
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      [
        'failed',
        'Conflict returned without a server record.',
        expect.any(String),
        'queue-1',
      ]
    );
  });

  it('marks queue items as failed when push response is missing item results', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [],
        },
      }),
    } as Response);

    const result = await engine.pushSync();

    expect(result).toEqual({
      success: 0,
      failed: 1,
      errors: ['Push response missing result for queue item queue-1'],
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      [
        'failed',
        'Push response missing result for queue item queue-1',
        expect.any(String),
        'queue-1',
      ]
    );
  });

  it('uses server push error message when response has no item results', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        error: 'Push validation failed',
        results: {
          itemResults: [],
        },
      }),
    } as Response);

    const result = await engine.pushSync();

    expect(result).toEqual({
      success: 0,
      failed: 1,
      errors: ['Push validation failed'],
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      ['failed', 'Push validation failed', expect.any(String), 'queue-1']
    );
  });

  it('uses server push error message for failed item when item-level error is missing', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        error: 'Push item validation failed',
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'failed',
            },
          ],
        },
      }),
    } as Response);

    const result = await engine.pushSync();

    expect(result).toEqual({
      success: 0,
      failed: 1,
      errors: ['Push item validation failed'],
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      ['failed', 'Push item validation failed', expect.any(String), 'queue-1']
    );
  });

  it('counts retry conflict without server record as failed', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'failed',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [
            {
              id: 'queue-1',
              status: 'conflict',
            },
          ],
        },
      }),
    } as Response);

    const result = await engine.retryFailedSyncItems();

    expect(result).toEqual({ retried: 1, success: 0, failed: 1 });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, updated_at = ? WHERE id = ?'
      ),
      [
        'failed',
        'Conflict returned without a server record.',
        expect.any(String),
        'queue-1',
      ]
    );
  });

  it('marks retry item as failed when retry response is missing item result', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'failed',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: {
          itemResults: [],
        },
      }),
    } as Response);

    const result = await engine.retryFailedSyncItems();

    expect(result).toEqual({ retried: 1, success: 0, failed: 1 });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, retry_count = retry_count + 1, updated_at = ? WHERE id = ?'
      ),
      [
        'failed',
        'Retry response missing result for queue item queue-1',
        expect.any(String),
        'queue-1',
      ]
    );
  });

  it('uses server retry error message when response has no itemResult', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'update',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 2,
        status: 'failed',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Retry validation failed',
        results: {
          itemResults: [],
        },
      }),
    } as Response);

    const result = await engine.retryFailedSyncItems();

    expect(result).toEqual({ retried: 1, success: 0, failed: 1 });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE sync_queue SET status = ?, error = ?, retry_count = retry_count + 1, updated_at = ? WHERE id = ?'
      ),
      [
        'failed',
        'Retry validation failed',
        expect.any(String),
        'queue-1',
      ]
    );
  });

  it('runs full sync in push-before-pull order', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'task',
        action: 'create',
        entity_id: 'task-1',
        data: JSON.stringify({ id: 'task-1' }),
        version: 1,
        status: 'pending',
        retry_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async input => {
      const url = String(input);
      if (url.includes('/api/sync/push')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            results: { itemResults: [{ id: 'queue-1', status: 'success' }] },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            tasks: [],
            reports: [],
            locations: [],
            serverTimestamp: '2025-01-01T12:00:00.000Z',
          },
        }),
      } as Response;
    });

    const result = await engine.fullSync();

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/sync/push');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/sync/pull');
    expect(result.pushed.success).toBe(1);
    expect(result.pulled.tasks).toBe(0);
  });

  it('throws SyncAuthUnavailableError when access token is missing', async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: {
        session: null,
      },
    });

    await expect(engine.pullSync()).rejects.toBeInstanceOf(
      SyncAuthUnavailableError
    );
  });
});
