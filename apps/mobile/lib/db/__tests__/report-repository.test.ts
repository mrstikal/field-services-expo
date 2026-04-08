import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ReportRepository } from '@lib/db/report-repository';
import { getDatabase } from '@lib/db/local-database';

vi.mock('@lib/db/local-database', () => ({
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  resetDatabase: vi.fn(),
}));

interface MockSQLiteDatabase {
  runAsync: Mock;
  getAllAsync: Mock;
  getFirstAsync: Mock;
  execAsync: Mock;
}

describe('ReportRepository', () => {
  let mockDb: MockSQLiteDatabase;
  let repo: ReportRepository;

  beforeEach(() => {
    mockDb = {
      runAsync: vi.fn().mockResolvedValue(undefined),
      getAllAsync: vi.fn().mockResolvedValue([]),
      getFirstAsync: vi.fn().mockResolvedValue(null),
      execAsync: vi.fn(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as SQLiteDatabase);
    repo = new ReportRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a local report and enqueues a create sync item', async () => {
    const result = await repo.create({
      task_id: 'task-1',
      status: 'draft',
      photos: ['photo1.jpg'],
      form_data: { note: 'ok' },
      signature: 'signature.png',
    });

    expect(result.version).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.deleted_at).toBeNull();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reports'),
      expect.arrayContaining([
        expect.any(String),
        'task-1',
        'draft',
        JSON.stringify(['photo1.jpg']),
        JSON.stringify({ note: 'ok' }),
      ])
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining([
        expect.any(String),
        'report',
        'create',
        result.id,
        expect.any(String),
        1,
      ])
    );
  });

  it('upserts a server report without re-enqueueing it', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft',
      photos: '[]',
      form_data: '{}',
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const result = await repo.upsertFromServer({
      id: 'report-1',
      task_id: 'task-1',
      status: 'completed',
      photos: ['photo1.jpg'],
      form_data: { note: 'server' },
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
      deleted_at: null,
      version: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.version).toBe(3);
    expect(result.synced).toBe(1);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports'),
      expect.arrayContaining([
        'task-1',
        'completed',
        expect.any(String),
        expect.any(String),
        3,
        1,
        'report-1',
      ])
    );
  });

  it('parses JSON-backed rows when listing reports', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 'report-1',
        task_id: 'task-1',
        status: 'completed',
        photos: '["photo.jpg"]',
        form_data: '{"field":"value"}',
        signature: null,
        pdf_url: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        deleted_at: null,
        version: 1,
        synced: 1,
      },
    ]);

    const result = await repo.getAll();

    expect(result).toEqual([
      expect.objectContaining({
        id: 'report-1',
        photos: ['photo.jpg'],
        form_data: { field: 'value' },
      }),
    ]);
  });

  it('updates an existing report and enqueues an update change', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft',
      photos: '[]',
      form_data: '{}',
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft',
      photos: '[]',
      form_data: '{}',
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const result = await repo.update('report-1', { status: 'completed' });

    expect(result?.status).toBe('completed');
    expect(result?.version).toBe(2);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports'),
      expect.arrayContaining([
        'task-1',
        'completed',
        expect.any(String),
        expect.any(String),
        2,
        0,
        'report-1',
      ])
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining([
        expect.any(String),
        'report',
        'update',
        'report-1',
        expect.any(String),
        2,
      ])
    );
  });

  it('soft deletes a report and enqueues a delete change', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft',
      photos: '[]',
      form_data: '{}',
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft',
      photos: '[]',
      form_data: '{}',
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const result = await repo.delete('report-1');

    expect(result).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports'),
      expect.arrayContaining([
        'task-1',
        'draft',
        expect.any(String),
        expect.any(String),
        2,
        0,
        'report-1',
      ])
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining([
        expect.any(String),
        'report',
        'delete',
        'report-1',
        expect.any(String),
        2,
      ])
    );
  });

  it('returns the server version when conflict resolution favors the server', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft',
      photos: '[]',
      form_data: '{}',
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const localReport = {
      id: 'report-1',
      task_id: 'task-1',
      status: 'draft' as const,
      photos: [],
      form_data: {},
      signature: null,
      pdf_url: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    };

    const remoteReport = {
      ...localReport,
      status: 'completed' as const,
      updated_at: '2025-01-02T00:00:00.000Z',
      version: 3,
    };

    const result = await repo.resolveConflict(localReport, remoteReport);

    expect(result).toEqual({
      ...remoteReport,
      synced: 1,
    });
  });
});
