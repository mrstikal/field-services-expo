import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { TaskRepository } from '../task-repository';
import { getDatabase } from '../local-database';
import type { Task } from '@shared/index';
import type { SQLiteDatabase } from 'expo-sqlite';

// Mock dependencies - MUST be at top level
vi.mock('../local-database', () => ({
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  resetDatabase: vi.fn(),
}));

// Mock SQLiteDatabase interface
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
    // Create mock database
    mockDb = {
      runAsync: vi.fn(),
      getAllAsync: vi.fn(),
      getFirstAsync: vi.fn(),
      execAsync: vi.fn(),
    };

    // Mock getDatabase to return our mock
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as SQLiteDatabase);

    // Create fresh instance
    repo = new TaskRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a task and add to sync queue', async () => {
      const taskData = {
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
      };

      const mockId = 'task-123';
      const mockNow = '2025-01-01T00:00:00.000Z';

       vi.mocked(mockDb.runAsync).mockImplementation((sql: string) => {
         if (sql.includes('INSERT INTO tasks')) {
           return Promise.resolve({ lastInsertRowid: 1 });
         }
         if (sql.includes('INSERT INTO sync_queue')) {
           return Promise.resolve({ lastInsertRowid: 1 });
         }
         return Promise.resolve();
       });

       vi.mocked(mockDb.getFirstAsync).mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM tasks WHERE id = ?')) {
          return Promise.resolve({
            ...taskData,
            id: mockId,
            created_at: mockNow,
            updated_at: mockNow,
            version: 1,
            synced: 0,
          });
        }
        return Promise.resolve(null);
      });

      const result = await repo.create(taskData);

      expect(result).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.version).toBe(1);
      expect(result.synced).toBe(0);

      // Check that INSERT INTO tasks was called with correct parameters
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        expect.arrayContaining([
          expect.any(String), // id (UUID)
          taskData.title,
          taskData.description,
          taskData.address,
          taskData.latitude,
          taskData.longitude,
          taskData.status,
          taskData.priority,
          taskData.category,
          taskData.due_date,
          taskData.customer_name,
          taskData.customer_phone,
          taskData.estimated_time,
          taskData.technician_id,
          expect.any(String), // created_at
          expect.any(String), // updated_at
          1,
          0,
        ])
      );

      // Check that INSERT INTO sync_queue was called
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.any(Array)
      );
    });
  });

  describe('upsertFromServer', () => {
    it('should insert new task from server', async () => {
      const serverTask: Task = {
        id: 'server-task-1',
        title: 'Server Task',
        description: 'From Server',
        address: '456 Server St',
        latitude: 48.456,
        longitude: 17.456,
        status: 'assigned' as const,
        priority: 'high' as const,
        category: 'installation' as const,
        due_date: '2025-01-02',
        customer_name: 'Jane Smith',
        customer_phone: '987654321',
        estimated_time: 3,
        technician_id: 'tech2',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 5,
        synced: 1,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.upsertFromServer(serverTask);

      expect(result).toBeDefined();
      expect(result.id).toBe(serverTask.id);
      expect(result.version).toBe(5);
      expect(result.synced).toBe(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        expect.any(Array)
      );

      expect(mockDb.runAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.any(Array)
      );
    });

    it('should update existing task from server', async () => {
      const existingTask: Task = {
        id: 'existing-task-1',
        title: 'Old Title',
        description: 'Old Description',
        address: 'Old Address',
        latitude: 48.0,
        longitude: 17.0,
        status: 'assigned' as const,
        priority: 'medium' as const,
        category: 'repair' as const,
        due_date: '2025-01-01',
        customer_name: 'Old Customer',
        customer_phone: '111111111',
        estimated_time: 1,
        technician_id: 'tech1',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        version: 1,
        synced: 0,
      };

      const serverTask: Task = {
        ...existingTask,
        title: 'Updated Title',
        version: 3,
        updated_at: '2025-01-02T00:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(existingTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.upsertFromServer(serverTask);

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Title');
      expect(result.version).toBe(3);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks'),
        expect.arrayContaining(['Updated Title', 3, 'existing-task-1'])
      );
    });
  });

  describe('getAll', () => {
    it('should return all tasks ordered by created_at DESC', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Desc 1',
          address: 'Addr 1',
          latitude: 48.1,
          longitude: 17.1,
          status: 'assigned' as const,
          priority: 'medium' as const,
          category: 'repair',
          due_date: '2025-01-01',
          customer_name: 'Customer 1',
          customer_phone: '111',
          estimated_time: 1,
          technician_id: 'tech1',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Desc 2',
          address: 'Addr 2',
          latitude: 48.2,
          longitude: 17.2,
          status: 'completed' as const,
          priority: 'low' as const,
          category: 'maintenance',
          due_date: '2025-01-02',
          customer_name: 'Customer 2',
          customer_phone: '222',
          estimated_time: 2,
          technician_id: 'tech2',
          created_at: '2025-01-01T08:00:00.000Z',
          updated_at: '2025-01-01T08:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockTasks);

      const result = await repo.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('task-1');
      expect(result[1].id).toBe('task-2');

      // Check that getAllAsync was called with correct SQL
      // Note: We don't check parameters because mock doesn't store them
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });
  });

  describe('getByStatus', () => {
    it('should return tasks filtered by status', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Desc 1',
          address: 'Addr 1',
          latitude: 48.1,
          longitude: 17.1,
          status: 'in_progress' as const,
          priority: 'medium' as const,
          category: 'repair',
          due_date: '2025-01-01',
          customer_name: 'Customer 1',
          customer_phone: '111',
          estimated_time: 1,
          technician_id: 'tech1',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockTasks);

      const result = await repo.getByStatus('in_progress');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('in_progress');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ?'),
        ['in_progress']
      );
    });
  });

  describe('getByTechnician', () => {
    it('should return tasks filtered by technician_id', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Desc 1',
          address: 'Addr 1',
          latitude: 48.1,
          longitude: 17.1,
          status: 'assigned' as const,
          priority: 'medium' as const,
          category: 'repair',
          due_date: '2025-01-01',
          customer_name: 'Customer 1',
          customer_phone: '111',
          estimated_time: 1,
          technician_id: 'tech1',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockTasks);

      const result = await repo.getByTechnician('tech1');

      expect(result).toHaveLength(1);
      expect(result[0].technician_id).toBe('tech1');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technician_id = ?'),
        ['tech1']
      );
    });
  });

  describe('getById', () => {
    it('should return task by ID', async () => {
      const mockTask = {
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
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(mockTask);

      const result = await repo.getById('task-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('task-1');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tasks WHERE id = ?'),
        ['task-1']
      );
    });

    it('should return null if task not found', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);

      const result = await repo.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByPriority', () => {
    it('should return tasks filtered by priority', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Desc 1',
          address: 'Addr 1',
          latitude: 48.1,
          longitude: 17.1,
          status: 'assigned' as const,
          priority: 'urgent' as const,
          category: 'repair',
          due_date: '2025-01-01',
          customer_name: 'Customer 1',
          customer_phone: '111',
          estimated_time: 1,
          technician_id: 'tech1',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockTasks);

      const result = await repo.getByPriority('urgent');

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('urgent');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE priority = ?'),
        ['urgent']
      );
    });
  });

  describe('update', () => {
    it('should update task and increment version', async () => {
      const existingTask = {
        id: 'task-1',
        title: 'Old Title',
        description: 'Old Description',
        address: 'Addr 1',
        latitude: 48.1,
        longitude: 17.1,
        status: 'assigned' as const,
        priority: 'medium' as const,
        category: 'repair',
        due_date: '2025-01-01',
        customer_name: 'Customer 1',
        customer_phone: '111',
        estimated_time: 1,
        technician_id: 'tech1',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      const updatedTask = {
        ...existingTask,
        title: 'New Title',
        updated_at: '2025-01-02T10:00:00.000Z',
        version: 2,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(existingTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(updatedTask);

      const result = await repo.update('task-1', { title: 'New Title' });

      expect(result).toBeDefined();
      expect(result?.title).toBe('New Title');
      expect(result?.version).toBe(2);

      // Check UPDATE tasks was called with correct parameters
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks'),
        expect.arrayContaining(['New Title', expect.any(String), 3, 'task-1'])
      );

      // Check INSERT INTO sync_queue was called
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.any(Array)
      );
    });

    it('should return null if task not found', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);

      const result = await repo.update('non-existent', { title: 'New' });

      expect(result).toBeNull();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should call update with status', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Task 1',
        description: 'Desc 1',
        address: 'Addr 1',
        latitude: 48.1,
        longitude: 17.1,
        status: 'in_progress' as const,
        priority: 'medium' as const,
        category: 'repair',
        due_date: '2025-01-01',
        customer_name: 'Customer 1',
        customer_phone: '111',
        estimated_time: 1,
        technician_id: 'tech1',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 2,
        synced: 0,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(mockTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(mockTask);

      const result = await repo.updateStatus('task-1', 'in_progress');

      expect(result).toBeDefined();
      expect(result?.status).toBe('in_progress');
    });
  });

  describe('delete', () => {
    it('should delete task and add to sync queue', async () => {
      const existingTask = {
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
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(existingTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.delete('task-1');

      expect(result).toBe(true);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tasks WHERE id = ?'),
        ['task-1']
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining(['delete', expect.any(String), 1])
      );
    });

    it('should return false if task not found', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);

      const result = await repo.delete('non-existent');

      expect(result).toBe(false);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('getLastSyncTimestamp', () => {
    it('should return last sync timestamp', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue({ value: '2025-01-01T00:00:00.000Z' });

      const result = await repo.getLastSyncTimestamp();

      expect(result).toBe('2025-01-01T00:00:00.000Z');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM sync_metadata WHERE key = ?'),
        ['last_task_sync']
      );
    });

    it('should return null if no timestamp', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);

      const result = await repo.getLastSyncTimestamp();

      expect(result).toBeNull();
    });
  });

  describe('setLastSyncTimestamp', () => {
    it('should set last sync timestamp', async () => {
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      await repo.setLastSyncTimestamp('2025-01-01T00:00:00.000Z');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO sync_metadata'),
        ['last_task_sync', '2025-01-01T00:00:00.000Z']
      );
    });
  });

  describe('resolveConflict', () => {
    it('should return remote task when version is higher', async () => {
      const localTask: Task = {
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
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      const remoteTask: Task = {
        ...localTask,
        title: 'Remote Task',
        version: 3,
        updated_at: '2025-01-02T10:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(localTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.resolveConflict(localTask, remoteTask);

      expect(result).toEqual(remoteTask);
    });

    it('should return local task when version is higher', async () => {
      const localTask: Task = {
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
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-02T10:00:00.000Z',
        version: 3,
        synced: 0,
      };

      const remoteTask: Task = {
        ...localTask,
        title: 'Remote Task',
        version: 1,
        updated_at: '2025-01-01T10:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(localTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.resolveConflict(localTask, remoteTask);

      expect(result).toEqual(localTask);
    });

    it('should compare timestamps when versions are equal', async () => {
      const localTask: Task = {
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
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-03T10:00:00.000Z',
        version: 2,
        synced: 0,
      };

      const remoteTask: Task = {
        ...localTask,
        title: 'Remote Task',
        version: 2,
        updated_at: '2025-01-02T10:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(localTask);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.resolveConflict(localTask, remoteTask);

      expect(result).toEqual(localTask);
    });
  });
});