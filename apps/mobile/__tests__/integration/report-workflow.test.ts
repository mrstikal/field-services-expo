import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportRepository } from '../../lib/db/report-repository';
import { getDatabase } from '../../lib/db/local-database';

// Mock local database
vi.mock('../../lib/db/local-database', () => ({
  getDatabase: vi.fn(),
}));

describe('Mobile Report Workflow Integration', () => {
  let repository: ReportRepository;
  const mockDb = {
    runAsync: vi.fn().mockResolvedValue({}),
    getAllAsync: vi.fn(),
    getFirstAsync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);
    repository = new ReportRepository();

    // Mock crypto.randomUUID
    if (!global.crypto.randomUUID) {
      (global as { crypto?: { randomUUID: () => string } }).crypto = {
        randomUUID: () => 'report-uuid-' + Math.random().toString(36).substring(2, 9),
      };
    }
  });

  it('should create a report and add it to the sync queue', async () => {
    const reportData = {
      task_id: 'task-123',
      technician_id: 'tech-1',
      status: 'completed' as const,
      form_data: { signature_url: 'path/to/signature.png', notes: 'Done' },
      photos: ['photo1.jpg', 'photo2.jpg'],
    };

    const report = await repository.create(reportData);

    expect(report.id).toBeDefined();
    expect(report.task_id).toBe(reportData.task_id);
    expect(report.version).toBe(1);

    // Verify report insertion
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reports'),
      expect.arrayContaining([report.id, reportData.task_id, 'completed'])
    );

    // Verify sync queue entries (report create + possibly task status update if handled by repository or engine)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining(['report', 'create', expect.any(String), 1])
    );
  });

  it('should update report status and version', async () => {
    const existingReport = {
      id: 'report-123',
      task_id: 'task-123',
      status: 'draft',
      version: 1,
      updated_at: new Date().toISOString(),
    };

    mockDb.getFirstAsync.mockResolvedValueOnce(existingReport);
    mockDb.getFirstAsync.mockResolvedValueOnce({ ...existingReport, status: 'completed', version: 2 });

    const updatedReport = await repository.updateStatus('report-123', 'completed');

    expect(updatedReport?.status).toBe('completed');
    expect(updatedReport?.version).toBe(2);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports SET status = ?'),
      expect.arrayContaining(['completed', expect.any(String), 2, 'report-123'])
    );
  });
});
