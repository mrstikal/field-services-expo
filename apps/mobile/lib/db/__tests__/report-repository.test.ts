import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { ReportRepository } from '../report-repository';
import { getDatabase } from '../local-database';
import type { Report } from '@shared/index';
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

describe('ReportRepository', () => {
  let mockDb: MockSQLiteDatabase;
  let repo: ReportRepository;

  beforeEach(() => {
    mockDb = {
      runAsync: vi.fn(),
      getAllAsync: vi.fn(),
      getFirstAsync: vi.fn(),
      execAsync: vi.fn(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as SQLiteDatabase);
    repo = new ReportRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a report and add to sync queue', async () => {
      const reportData = {
        task_id: 'task-1',
        status: 'draft',
        photos: ['photo1.jpg', 'photo2.jpg'],
        form_data: { field1: 'value1', field2: 'value2' },
        signature: 'signature.png',
      };

      const mockId = 'report-123';
      const mockNow = '2025-01-01T00:00:00.000Z';

       vi.mocked(mockDb.runAsync).mockImplementation((sql: string) => {
         if (sql.includes('INSERT INTO reports')) {
           return Promise.resolve({ lastInsertRowid: 1 });
         }
         if (sql.includes('INSERT INTO sync_queue')) {
           return Promise.resolve({ lastInsertRowid: 1 });
         }
         return Promise.resolve();
       });

      vi.mocked(mockDb.getFirstAsync).mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM reports WHERE id = ?')) {
          return Promise.resolve({
            ...reportData,
            id: mockId,
            created_at: mockNow,
            updated_at: mockNow,
            version: 1,
            synced: 0,
          });
        }
        return Promise.resolve(null);
      });

      const result = await repo.create(reportData);

      expect(result).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.version).toBe(1);
      expect(result.synced).toBe(0);

      // Check that INSERT INTO reports was called with correct parameters
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reports'),
        expect.arrayContaining([
          expect.any(String), // id (UUID)
          reportData.task_id,
          reportData.status,
          JSON.stringify(reportData.photos),
          JSON.stringify(reportData.form_data),
          reportData.signature,
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
    it('should insert new report from server', async () => {
      const serverReport = {
        id: 'server-report-1',
        task_id: 'task-1',
        status: 'completed' as const,
        photos: ['photo1.jpg'],
        form_data: { field1: 'value1' },
        signature: 'signature.png',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 5,
        synced: 1,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.upsertFromServer(serverReport);

      expect(result).toBeDefined();
      expect(result.id).toBe(serverReport.id);
      expect(result.version).toBe(5);
      expect(result.synced).toBe(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reports'),
        expect.any(Array)
      );

      expect(mockDb.runAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.any(Array)
      );
    });

    it('should update existing report from server', async () => {
      const existingReport = {
        id: 'existing-report-1',
        task_id: 'task-1',
        status: 'draft' as const,
        photos: [],
        form_data: {},
        signature: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        version: 1,
        synced: 0,
      };

      const serverReport: Report = {
        ...existingReport,
        status: 'completed' as const,
        version: 3,
        updated_at: '2025-01-02T00:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(existingReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.upsertFromServer(serverReport);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.version).toBe(3);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reports'),
        expect.arrayContaining(['completed', 3, 'existing-report-1'])
      );
    });
  });

  describe('getAll', () => {
    it('should return all reports ordered by created_at DESC', async () => {
      const mockReports = [
        {
          id: 'report-1',
          task_id: 'task-1',
          status: 'draft' as const,
          photos: [],
          form_data: {},
          signature: null,
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
        {
          id: 'report-2',
          task_id: 'task-2',
          status: 'completed' as const,
          photos: ['photo.jpg'],
          form_data: { field1: 'value1' },
          signature: 'signature.png',
          created_at: '2025-01-01T08:00:00.000Z',
          updated_at: '2025-01-01T08:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockReports);

      const result = await repo.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('report-1');
      expect(result[1].id).toBe('report-2');
    });
  });

  describe('getByTaskId', () => {
    it('should return reports filtered by task_id', async () => {
      const mockReports = [
        {
          id: 'report-1',
          task_id: 'task-1',
          status: 'draft' as const,
          photos: [],
          form_data: {},
          signature: null,
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockReports);

      const result = await repo.getByTaskId('task-1');

      expect(result).toHaveLength(1);
      expect(result[0].task_id).toBe('task-1');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE task_id = ?'),
        ['task-1']
      );
    });
  });

  describe('getById', () => {
    it('should return report by ID', async () => {
      const mockReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'draft',
        photos: [],
        form_data: {},
        signature: null,
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(mockReport);

      const result = await repo.getById('report-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('report-1');
    });

    it('should return null if report not found', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);

      const result = await repo.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByStatus', () => {
    it('should return reports filtered by status', async () => {
      const mockReports = [
        {
          id: 'report-1',
          task_id: 'task-1',
          status: 'completed' as const,
          photos: ['photo.jpg'],
          form_data: { field1: 'value1' },
          signature: 'signature.png',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T10:00:00.000Z',
          version: 1,
          synced: 0,
        },
      ];

      vi.mocked(mockDb.getAllAsync).mockResolvedValue(mockReports);

      const result = await repo.getByStatus('completed');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ?'),
        ['completed']
      );
    });
  });

  describe('update', () => {
    it('should update report and increment version', async () => {
      const existingReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'draft' as const,
        photos: [],
        form_data: {},
        signature: null,
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      const updatedReport = {
        ...existingReport,
        status: 'completed' as const,
        updated_at: '2025-01-02T10:00:00.000Z',
        version: 2,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(existingReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(updatedReport);

      const result = await repo.update('report-1', { status: 'completed' });

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(result?.version).toBe(2);

      // Check UPDATE reports was called with correct parameters
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reports'),
        expect.arrayContaining(['completed', expect.any(String), 3, 'report-1'])
      );

      // Check INSERT INTO sync_queue was called
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.any(Array)
      );
    });

    it('should return null if report not found', async () => {
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(null);

      const result = await repo.update('non-existent', { status: 'completed' });

      expect(result).toBeNull();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should call update with status', async () => {
      const mockReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'completed' as const,
        photos: ['photo.jpg'],
        form_data: { field1: 'value1' },
        signature: 'signature.png',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 2,
        synced: 0,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(mockReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);
      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(mockReport);

      const result = await repo.updateStatus('report-1', 'completed');

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
    });
  });

  describe('delete', () => {
    it('should delete report and add to sync queue', async () => {
      const existingReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'draft',
        photos: [],
        form_data: {},
        signature: null,
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(existingReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.delete('report-1');

      expect(result).toBe(true);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM reports WHERE id = ?'),
        ['report-1']
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining(['delete', expect.any(String), 1])
      );
    });

    it('should return false if report not found', async () => {
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
        ['last_report_sync']
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
        ['last_report_sync', '2025-01-01T00:00:00.000Z']
      );
    });
  });

  describe('resolveConflict', () => {
    it('should return remote report when version is higher', async () => {
      const localReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'draft' as const,
        photos: [],
        form_data: {},
        signature: null,
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        version: 1,
        synced: 0,
      };

      const remoteReport = {
        ...localReport,
        status: 'completed' as const,
        version: 3,
        updated_at: '2025-01-02T10:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(localReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.resolveConflict(localReport, remoteReport);

      expect(result).toEqual(remoteReport);
    });

    it('should return local report when version is higher', async () => {
      const localReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'completed' as const,
        photos: ['photo.jpg'],
        form_data: { field1: 'value1' },
        signature: 'signature.png',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-02T10:00:00.000Z',
        version: 3,
        synced: 0,
      };

      const remoteReport = {
        ...localReport,
        status: 'draft' as const,
        version: 1,
        updated_at: '2025-01-01T10:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(localReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.resolveConflict(localReport, remoteReport);

      expect(result).toEqual(localReport);
    });

    it('should compare timestamps when versions are equal', async () => {
      const localReport = {
        id: 'report-1',
        task_id: 'task-1',
        status: 'completed' as const,
        photos: ['photo.jpg'],
        form_data: { field1: 'value1' },
        signature: 'signature.png',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-03T10:00:00.000Z',
        version: 2,
        synced: 0,
      };

      const remoteReport = {
        ...localReport,
        status: 'draft' as const,
        version: 2,
        updated_at: '2025-01-02T10:00:00.000Z',
      };

      vi.mocked(mockDb.getFirstAsync).mockResolvedValue(localReport);
      vi.mocked(mockDb.runAsync).mockResolvedValue(undefined);

      const result = await repo.resolveConflict(localReport, remoteReport);

      expect(result).toEqual(localReport);
    });
  });
});