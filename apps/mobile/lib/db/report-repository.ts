import { getDatabase } from './local-database';
import type {
  LocalReport,
  Report,
  ReportStatus,
} from '@field-service/shared-types';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  clearPendingChangesForEntity,
  enqueueSyncChange,
  emitSyncEvent,
  recordSyncConflict,
} from '@/lib/sync/sync-events';

interface ReportRow extends Omit<LocalReport, 'photos' | 'form_data'> {
  photos: string;
  form_data: string;
}

type NewReportInput = Partial<
  Omit<
    LocalReport,
    'created_at' | 'updated_at' | 'version' | 'synced' | 'deleted_at'
  >
> &
  Pick<LocalReport, 'task_id'>;

function parseJsonField<T>(
  value: string | T | null | undefined,
  fallback: T
): T {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapReportRow(row: ReportRow | null): LocalReport | null {
  if (!row) return null;
  return {
    ...row,
    photos: parseJsonField(row.photos, [] as string[]),
    form_data: parseJsonField(row.form_data, {} as Record<string, unknown>),
    deleted_at: row.deleted_at ?? null,
    synced: row.synced ?? 0,
  };
}

export class ReportRepository {
  private db: SQLiteDatabase | null = null;

  constructor(db?: SQLiteDatabase) {
    this.db = db || null;
  }

  private getDb(): SQLiteDatabase {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  private async writeLocalReport(report: LocalReport) {
    const existing = await this.getById(report.id, { includeDeleted: true });

    if (existing) {
      await this.getDb().runAsync(
        `UPDATE reports SET
          task_id = ?, status = ?, photos = ?, form_data = ?, signature = ?, pdf_url = ?,
          created_at = ?, updated_at = ?, deleted_at = ?, version = ?, synced = ?
         WHERE id = ?`,
        [
          report.task_id,
          report.status,
          JSON.stringify(report.photos),
          JSON.stringify(report.form_data),
          report.signature,
          report.pdf_url,
          report.created_at,
          report.updated_at,
          report.deleted_at,
          report.version,
          report.synced,
          report.id,
        ]
      );
      return;
    }

    await this.getDb().runAsync(
      `INSERT INTO reports (
        id, task_id, status, photos, form_data, signature, pdf_url, created_at, updated_at, deleted_at, version, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id,
        report.task_id,
        report.status,
        JSON.stringify(report.photos),
        JSON.stringify(report.form_data),
        report.signature,
        report.pdf_url,
        report.created_at,
        report.updated_at,
        report.deleted_at,
        report.version,
        report.synced,
      ]
    );
  }

  async create(report: NewReportInput): Promise<LocalReport> {
    const now = new Date().toISOString();
    const newReport: LocalReport = {
      id: report.id || crypto.randomUUID(),
      task_id: report.task_id,
      status: report.status ?? 'draft',
      photos: report.photos ?? [],
      form_data: report.form_data ?? {},
      signature: report.signature ?? null,
      pdf_url: report.pdf_url ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      synced: 0,
    };

    await this.writeLocalReport(newReport);
    await enqueueSyncChange({
      type: 'report',
      action: 'create',
      entityId: newReport.id,
      data: newReport,
      version: newReport.version,
    });
    return newReport;
  }

  async upsertFromServer(report: Report): Promise<LocalReport> {
    const localReport: LocalReport = {
      id: report.id,
      task_id: report.task_id,
      status: report.status,
      photos: report.photos,
      form_data: report.form_data,
      signature: report.signature,
      pdf_url: report.pdf_url ?? null,
      created_at: report.created_at,
      updated_at: report.updated_at,
      deleted_at: report.deleted_at ?? null,
      version: report.version,
      synced: 1,
    };

    await this.writeLocalReport(localReport);
    await clearPendingChangesForEntity('report', localReport.id);
    emitSyncEvent();
    return localReport;
  }

  async getAll(): Promise<LocalReport[]> {
    const rows = await this.getDb().getAllAsync<ReportRow>(
      'SELECT * FROM reports WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
    return rows.map(row => mapReportRow(row) as LocalReport);
  }

  async getByTaskId(taskId: string): Promise<LocalReport[]> {
    const rows = await this.getDb().getAllAsync<ReportRow>(
      'SELECT * FROM reports WHERE task_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [taskId]
    );
    return rows.map(row => mapReportRow(row) as LocalReport);
  }

  async getById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<LocalReport | null> {
    const includeDeleted = options?.includeDeleted ?? false;
    const sql = includeDeleted
      ? 'SELECT * FROM reports WHERE id = ?'
      : 'SELECT * FROM reports WHERE id = ? AND deleted_at IS NULL';
    const row = await this.getDb().getFirstAsync<ReportRow>(sql, [id]);
    return mapReportRow(row);
  }

  async getByStatus(status: ReportStatus): Promise<LocalReport[]> {
    const rows = await this.getDb().getAllAsync<ReportRow>(
      'SELECT * FROM reports WHERE status = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [status]
    );
    return rows.map(row => mapReportRow(row) as LocalReport);
  }

  async update(
    id: string,
    updates: Partial<LocalReport>
  ): Promise<LocalReport | null> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deleted_at) return null;

    const updated: LocalReport = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      version: existing.version + 1,
      synced: 0,
      deleted_at: existing.deleted_at,
      pdf_url: updates.pdf_url ?? existing.pdf_url,
    };

    await this.writeLocalReport(updated);
    await enqueueSyncChange({
      type: 'report',
      action: 'update',
      entityId: id,
      data: updated,
      version: updated.version,
    });
    return updated;
  }

  async updateStatus(
    id: string,
    status: ReportStatus
  ): Promise<LocalReport | null> {
    return this.update(id, { status });
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deleted_at) return false;

    const now = new Date().toISOString();
    const deletedReport: LocalReport = {
      ...existing,
      deleted_at: now,
      updated_at: now,
      version: existing.version + 1,
      synced: 0,
    };

    await this.writeLocalReport(deletedReport);
    await enqueueSyncChange({
      type: 'report',
      action: 'delete',
      entityId: id,
      data: {
        id,
        deleted_at: now,
        updated_at: now,
        version: deletedReport.version,
      },
      version: deletedReport.version,
    });
    return true;
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    const result = await this.getDb().getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['last_report_sync']
    );
    return result?.value || null;
  }

  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.getDb().runAsync(
      'INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)',
      ['last_report_sync', timestamp]
    );
  }

  async resolveConflict(
    localReport: LocalReport,
    remoteReport: Report
  ): Promise<LocalReport> {
    const localTime = new Date(localReport.updated_at).getTime();
    const remoteTime = new Date(remoteReport.updated_at).getTime();
    const serverWins =
      remoteReport.version > localReport.version ||
      (remoteReport.version === localReport.version && remoteTime >= localTime);

    await recordSyncConflict({
      entityType: 'report',
      entityId: localReport.id,
      localData: localReport,
      serverData: remoteReport,
      resolution: serverWins ? 'server_wins' : 'local_wins',
    });

    if (serverWins) {
      return this.upsertFromServer(remoteReport);
    }

    return localReport;
  }
}

export const reportRepository = new ReportRepository();
