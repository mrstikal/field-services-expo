import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { TaskRepository } from '@lib/db/task-repository';
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

describe('TaskRepository', () => {
  let mockDb: MockSQLiteDatabase;
  let repo: TaskRepository;

  beforeEach(() => {
    mockDb = {
      runAsync: vi.fn().mockResolvedValue(undefined),
      getAllAsync: vi.fn().mockResolvedValue([]),
      getFirstAsync: vi.fn().mockResolvedValue(null),
      execAsync: vi.fn(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as SQLiteDatabase);
    repo = new TaskRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a local task and enqueues a create change', async () => {
    const result = await repo.create({
      title: 'Test Task',
      description: 'Test Description',
      address: '123 Test St',
      latitude: 48.123,
      longitude: 17.123,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'John Doe',
      customer_phone: '123456789',
      estimated_time: 2,
      technician_id: 'tech1',
    });

    expect(result.version).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.deleted_at).toBeNull();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tasks'),
      expect.arrayContaining([
        expect.any(String),
        'Test Task',
        'Test Description',
        '123 Test St',
        48.123,
        17.123,
        'assigned',
        'medium',
        'repair',
        '2025-01-01',
      ])
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining([
        expect.any(String),
        'task',
        'create',
        result.id,
        expect.any(String),
        1,
      ])
    );
  });

  it('upserts a server task without re-enqueueing it', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Local Task',
      description: 'Local Description',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const result = await repo.upsertFromServer({
      id: 'task-1',
      title: 'Remote Task',
      description: 'Remote Description',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
      deleted_at: null,
      version: 3,
    });

    expect(result.title).toBe('Remote Task');
    expect(result.version).toBe(3);
    expect(result.synced).toBe(1);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks'),
      expect.arrayContaining([
        'Remote Task',
        'Remote Description',
        'Addr 1',
        48.1,
        17.1,
        'assigned',
        'medium',
        'repair',
        '2025-01-01',
      ])
    );
  });

  it('filters soft-deleted tasks out of regular reads', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'Desc 1',
        address: 'Addr 1',
        latitude: 48.1,
        longitude: 17.1,
        status: 'assigned',
        priority: 'medium',
        category: 'repair',
        due_date: '2025-01-01',
        customer_name: 'Customer 1',
        customer_phone: '111',
        estimated_time: 1,
        technician_id: 'tech1',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        deleted_at: null,
        version: 1,
        synced: 0,
      },
    ]);

    const result = await repo.getAll();

    expect(result).toEqual([
      expect.objectContaining({
        id: 'task-1',
        deleted_at: null,
      }),
    ]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE deleted_at IS NULL')
    );
  });

  it('updates an existing task and enqueues an update change', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Local Task',
      description: 'Local Description',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Local Task',
      description: 'Local Description',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const result = await repo.update('task-1', { title: 'New Title' });

    expect(result?.title).toBe('New Title');
    expect(result?.version).toBe(2);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks'),
      expect.arrayContaining([
        'New Title',
        'Local Description',
        'Addr 1',
        48.1,
        17.1,
        'assigned',
        'medium',
        'repair',
        '2025-01-01',
      ])
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining([
        expect.any(String),
        'task',
        'update',
        'task-1',
        expect.any(String),
        2,
      ])
    );
  });

  it('soft deletes a task and enqueues a delete change', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Task 1',
      description: 'Desc 1',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Task 1',
      description: 'Desc 1',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const result = await repo.delete('task-1');

    expect(result).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks'),
      expect.arrayContaining([
        'Task 1',
        'Desc 1',
        'Addr 1',
        48.1,
        17.1,
        'assigned',
        'medium',
        'repair',
        '2025-01-01',
      ])
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining([
        expect.any(String),
        'task',
        'delete',
        'task-1',
        expect.any(String),
        2,
      ])
    );
  });

  it('returns the server version when conflict resolution favors the server', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Local Task',
      description: 'Local Description',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned',
      priority: 'medium',
      category: 'repair',
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    });

    const localTask = {
      id: 'task-1',
      title: 'Local Task',
      description: 'Local Description',
      address: 'Addr 1',
      latitude: 48.1,
      longitude: 17.1,
      status: 'assigned' as const,
      priority: 'medium' as const,
      category: 'repair' as const,
      due_date: '2025-01-01',
      customer_name: 'Customer 1',
      customer_phone: '111',
      estimated_time: 1,
      technician_id: 'tech1',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      deleted_at: null,
      version: 1,
      synced: 0,
    };

    const remoteTask = {
      ...localTask,
      title: 'Remote Task',
      updated_at: '2025-01-02T00:00:00.000Z',
      version: 3,
    };

    const result = await repo.resolveConflict(localTask, remoteTask);

    expect(result).toEqual({
      ...remoteTask,
      synced: 1,
    });
  });
});
