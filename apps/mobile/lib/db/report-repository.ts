import { getDatabase } from './local-database';
import { Report, ReportStatus } from '@shared/index';
import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Report Repository - Local database operations for reports
 * Implements offline-first pattern with sync queue integration
 */
export class ReportRepository {
  private db: SQLiteDatabase | null = null;

  private getDb(): SQLiteDatabase {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  // ==================== CREATE ====================

   /**
    * Create a new report locally
    * Automatically adds to sync_queue for later sync
    */
    async create(report: Omit<Report, 'created_at' | 'updated_at' | 'version' | 'synced'>): Promise<Report> {
      const now = new Date().toISOString();
      const id = (report as Omit<Report, 'created_at' | 'updated_at' | 'version' | 'synced'> & { id?: string }).id || crypto.randomUUID();
     const version = 1;

     const newReport: Report = {
       ...report,
       id,
       created_at: now,
       updated_at: now,
       version,
       synced: 0,
     } as Report;

     // Insert report
     await this.getDb().runAsync(
       `INSERT INTO reports (
         id, task_id, status, photos, form_data, signature, created_at, updated_at, version, synced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
       [
         newReport.id,
         newReport.task_id,
         newReport.status,
         JSON.stringify(newReport.photos),
         JSON.stringify(newReport.form_data),
         newReport.signature,
         newReport.created_at,
         newReport.updated_at,
         newReport.version,
         newReport.synced,
       ]
     );

     // Add to sync queue
     await this.addToSyncQueue('report', 'create', newReport, version);

     return newReport;
   }
   
   /**
    * Create or update a report from server data (without adding to sync queue)
    * Used during pull sync to avoid creating duplicate sync queue entries
    */
   async upsertFromServer(report: Report): Promise<Report> {
     const now = new Date().toISOString();
     const id = report.id || crypto.randomUUID();

     const reportToInsert: Report = {
       ...report,
       id,
       created_at: report.created_at || now,
       updated_at: report.updated_at || now,
       version: report.version || 1, // Preserve server version
       synced: report.synced !== undefined ? report.synced : 0,
     };

     // Upsert report (update if exists, insert if not)
     // Check if report exists first
     const existingReport = await this.getById(reportToInsert.id);
     if (existingReport) {
       // Update existing report with server data (preserving server version and timestamps)
       await this.getDb().runAsync(
         `UPDATE reports SET
           task_id = ?,
           status = ?,
           photos = ?,
           form_data = ?,
           signature = ?,
           updated_at = ?,  -- Use server timestamp
           version = ?      -- Use server version
         WHERE id = ?`,
         [
           reportToInsert.task_id,
           reportToInsert.status,
           JSON.stringify(reportToInsert.photos),
           JSON.stringify(reportToInsert.form_data),
           reportToInsert.signature,
           reportToInsert.updated_at,
           reportToInsert.version,
           reportToInsert.id
         ]
       );
     } else {
       // Insert new report
       await this.getDb().runAsync(
         `INSERT INTO reports (
           id, task_id, status, photos, form_data, signature, created_at, updated_at, version, synced
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [
           reportToInsert.id,
           reportToInsert.task_id,
           reportToInsert.status,
           JSON.stringify(reportToInsert.photos),
           JSON.stringify(reportToInsert.form_data),
           reportToInsert.signature,
           reportToInsert.created_at,
           reportToInsert.updated_at,
           reportToInsert.version,
           reportToInsert.synced,
         ]
       );
     }

     // Do NOT add to sync queue - this is server data, not local changes

     return reportToInsert;
   }

  // ==================== READ ====================

  /**
   * Get all reports
   */
  async getAll(): Promise<Report[]> {
    return this.getDb().getAllAsync<Report>(
      `SELECT * FROM reports ORDER BY created_at DESC`
    );
  }

  /**
   * Get reports by task ID
   */
  async getByTaskId(taskId: string): Promise<Report[]> {
    return this.getDb().getAllAsync<Report>(
      `SELECT * FROM reports WHERE task_id = ? ORDER BY created_at DESC`,
      [taskId]
    );
  }

  /**
   * Get report by ID
   */
  async getById(id: string): Promise<Report | null> {
    return this.getDb().getFirstAsync<Report>(
      `SELECT * FROM reports WHERE id = ?`,
      [id]
    );
  }

  /**
   * Get reports by status
   */
  async getByStatus(status: ReportStatus): Promise<Report[]> {
    return this.getDb().getAllAsync<Report>(
      `SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
  }

  // ==================== UPDATE ====================

  /**
   * Update an existing report
   * Automatically increments version and adds to sync queue
   */
  async update(id: string, updates: Partial<Report>): Promise<Report | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const version = existing.version + 1;

     // Build update query dynamically
     const updateFields: string[] = [];
     const params: (string | number | null)[] = [];

    if (updates.task_id !== undefined) {
      updateFields.push('task_id = ?');
      params.push(updates.task_id);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.photos !== undefined) {
      updateFields.push('photos = ?');
      params.push(JSON.stringify(updates.photos));
    }
    if (updates.form_data !== undefined) {
      updateFields.push('form_data = ?');
      params.push(JSON.stringify(updates.form_data));
    }
    if (updates.signature !== undefined) {
      updateFields.push('signature = ?');
      params.push(updates.signature);
    }

    updateFields.push('updated_at = ?');
    updateFields.push('version = ?');
    params.push(now);
    params.push(version);

    params.push(id);

    await this.getDb().runAsync(
      `UPDATE reports SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    // Get updated report
    const updated = await this.getById(id);

    if (updated) {
      // Add to sync queue
      await this.addToSyncQueue('report', 'update', updated, version);
    }

    return updated;
  }

  /**
   * Update report status (convenience method)
   */
  async updateStatus(id: string, status: ReportStatus): Promise<Report | null> {
    return this.update(id, { status });
  }

  // ==================== DELETE ====================

  /**
   * Delete a report
   * Adds to sync queue for server-side deletion
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    await this.getDb().runAsync(`DELETE FROM reports WHERE id = ?`, [id]);

    // Add to sync queue for server-side deletion
    await this.addToSyncQueue('report', 'delete', { id }, existing.version);

    return true;
  }

  // ==================== SYNC QUEUE ====================

  /**
   * Add report to sync queue
   */
  private async addToSyncQueue(
    type: 'task' | 'report' | 'location',
    action: 'create' | 'update' | 'delete',
    data: Record<string, unknown>,
    version: number
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.getDb().runAsync(
      `INSERT INTO sync_queue (id, type, action, data, version, status, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [
        crypto.randomUUID(),
        type,
        action,
        JSON.stringify(data),
        version,
        now,
        now,
      ]
    );
  }

  // ==================== SYNC METADATA ====================

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(): Promise<string | null> {
    const result = await this.getDb().getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = ?`,
      ['last_report_sync']
    );
    return result?.value || null;
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.getDb().runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)`,
      ['last_report_sync', timestamp]
    );
  }

  // ==================== CONFLICT RESOLUTION ====================

  /**
   * Resolve sync conflict using "last write wins"
   * Returns the winning record
   */
  async resolveConflict(localReport: Report, remoteReport: Report): Promise<Report> {
    // Compare versions
    if (remoteReport.version > localReport.version) {
      // Remote wins
      await this.update(localReport.id, remoteReport);
      return remoteReport;
    } else if (localReport.version > remoteReport.version) {
      // Local wins - update remote version
      await this.update(localReport.id, { version: localReport.version });
      return localReport;
    } else {
      // Same version - compare timestamps
      const localTime = new Date(localReport.updated_at).getTime();
      const remoteTime = new Date(remoteReport.updated_at).getTime();

      if (remoteTime > localTime) {
        await this.update(localReport.id, remoteReport);
        return remoteReport;
      } else {
        await this.update(localReport.id, { version: localReport.version });
        return localReport;
      }
    }
  }
}

// Singleton instance
export const reportRepository = new ReportRepository();