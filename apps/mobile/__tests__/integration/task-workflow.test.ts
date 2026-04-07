import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRepository } from '../../lib/db/task-repository';
import { getDatabase } from '../../lib/db/local-database';

// Mock local database
vi.mock('../../lib/db/local-database', () => ({
  getDatabase: vi.fn(),
}));

describe('Mobile Task Workflow Integration', () => {
  let repository: TaskRepository;
  const mockDb = {
    runAsync: vi.fn().mockResolvedValue({}),
    getAllAsync: vi.fn(),
    getFirstAsync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);
    repository = new TaskRepository();
    
    // Mock crypto.randomUUID for consistent IDs in tests
    if (!global.crypto.randomUUID) {
        (global as { crypto?: { randomUUID: () => string } }).crypto = {
            randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 9)
        };
    }
  });

  it('should create a task and add it to the sync queue', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      address: 'Test Address',
      status: 'assigned' as const,
      priority: 'high' as const,
      category: 'repair' as const,
      technician_id: 'tech-1',
    };

    const task = await repository.create(taskData);

    expect(task.id).toBeDefined();
    expect(task.title).toBe(taskData.title);
    expect(task.version).toBe(1);
    expect(task.synced).toBe(0);

    // Verify task insertion
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tasks'),
      expect.arrayContaining([task.id, taskData.title])
    );

    // Verify sync queue insertion
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining(['task', 'create', expect.any(String), 1])
    );
  });

  it('should update task status and increment version', async () => {
    const existingTask = {
      id: 'task-123',
      title: 'Existing Task',
      version: 1,
      updated_at: new Date().toISOString(),
      status: 'assigned',
    };

    mockDb.getFirstAsync.mockResolvedValueOnce(existingTask);
    mockDb.getFirstAsync.mockResolvedValueOnce({ ...existingTask, status: 'in_progress', version: 2 });

    const updatedTask = await repository.updateStatus('task-123', 'in_progress');

    expect(updatedTask?.status).toBe('in_progress');
    expect(updatedTask?.version).toBe(2);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET status = ?, updated_at = ?, version = ? WHERE id = ?'),
      expect.arrayContaining(['in_progress', expect.any(String), 2, 'task-123'])
    );

    // Verify sync queue update entry
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining(['task', 'update', expect.any(String), 2])
    );
  });

  it('should delete a task and add delete action to sync queue', async () => {
    const existingTask = { id: 'task-123', version: 1 };
    mockDb.getFirstAsync.mockResolvedValue(existingTask);

    const result = await repository.delete('task-123');

    expect(result).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM tasks WHERE id = ?'),
      ['task-123']
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining(['task', 'delete', expect.any(String), 1])
    );
  });
});
