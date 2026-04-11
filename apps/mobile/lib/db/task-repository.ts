import { getDatabase } from './local-database';
import type {
  LocalTask,
  Task,
  TaskPriority,
  TaskStatus,
} from '@field-service/shared-types';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  clearPendingChangesForEntity,
  enqueueSyncChange,
  emitSyncEvent,
  recordSyncConflict,
} from '@/lib/sync/sync-events';
import { generateId } from '@/lib/utils/generate-id';

interface TaskRow extends Omit<LocalTask, 'latitude' | 'longitude'> {
  latitude: number | null;
  longitude: number | null;
}

type NewTaskInput = Partial<
  Omit<
    LocalTask,
    'created_at' | 'updated_at' | 'version' | 'synced' | 'deleted_at'
  >
> &
  Pick<LocalTask, 'title' | 'description' | 'address'>;

function mapTaskRow(row: TaskRow | null): LocalTask | null {
  if (!row) return null;
  return {
    ...row,
    latitude: row.latitude,
    longitude: row.longitude,
    deleted_at: row.deleted_at ?? null,
    synced: row.synced ?? 0,
  };
}

export class TaskRepository {
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

  private async writeLocalTask(task: LocalTask) {
    const existing = await this.getById(task.id, { includeDeleted: true });

    if (existing) {
      await this.getDb().runAsync(
        `UPDATE tasks SET
          title = ?, description = ?, address = ?, latitude = ?, longitude = ?,
          status = ?, priority = ?, category = ?, due_date = ?, customer_name = ?,
          customer_phone = ?, estimated_time = ?, technician_id = ?, created_at = ?,
          updated_at = ?, deleted_at = ?, version = ?, synced = ?
         WHERE id = ?`,
        [
          task.title,
          task.description,
          task.address,
          task.latitude,
          task.longitude,
          task.status,
          task.priority,
          task.category,
          task.due_date,
          task.customer_name,
          task.customer_phone,
          task.estimated_time,
          task.technician_id,
          task.created_at,
          task.updated_at,
          task.deleted_at,
          task.version,
          task.synced,
          task.id,
        ]
      );
      return;
    }

    await this.getDb().runAsync(
      `INSERT INTO tasks (
        id, title, description, address, latitude, longitude, status, priority, category, due_date,
        customer_name, customer_phone, estimated_time, technician_id, created_at, updated_at,
        deleted_at, version, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.address,
        task.latitude,
        task.longitude,
        task.status,
        task.priority,
        task.category,
        task.due_date,
        task.customer_name,
        task.customer_phone,
        task.estimated_time,
        task.technician_id,
        task.created_at,
        task.updated_at,
        task.deleted_at,
        task.version,
        task.synced,
      ]
    );
  }

  async create(task: NewTaskInput): Promise<LocalTask> {
    const now = new Date().toISOString();
    const newTask: LocalTask = {
      id: task.id || generateId(),
      title: task.title,
      description: task.description,
      address: task.address,
      latitude: task.latitude ?? null,
      longitude: task.longitude ?? null,
      status: task.status ?? 'assigned',
      priority: task.priority ?? 'medium',
      category: task.category ?? 'repair',
      due_date: task.due_date ?? now,
      customer_name: task.customer_name ?? 'Unknown customer',
      customer_phone: task.customer_phone ?? 'Unknown phone',
      estimated_time: task.estimated_time ?? 60,
      technician_id: task.technician_id ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      synced: 0,
    };

    await this.writeLocalTask(newTask);
    await enqueueSyncChange({
      type: 'task',
      action: 'create',
      entityId: newTask.id,
      data: newTask,
      version: newTask.version,
    });
    return newTask;
  }

  async upsertFromServer(task: Task): Promise<LocalTask> {
    const localTask: LocalTask = {
      ...task,
      deleted_at: task.deleted_at ?? null,
      synced: 1,
    };

    await this.writeLocalTask(localTask);
    await clearPendingChangesForEntity('task', localTask.id);
    emitSyncEvent();
    return localTask;
  }

  async getAll(): Promise<LocalTask[]> {
    const rows = await this.getDb().getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
    return rows.map(row => mapTaskRow(row) as LocalTask);
  }

  async getByStatus(status: TaskStatus): Promise<LocalTask[]> {
    const rows = await this.getDb().getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE status = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [status]
    );
    return rows.map(row => mapTaskRow(row) as LocalTask);
  }

  async getByTechnician(technicianId: string): Promise<LocalTask[]> {
    const rows = await this.getDb().getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE technician_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [technicianId]
    );
    return rows.map(row => mapTaskRow(row) as LocalTask);
  }

  async getById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<LocalTask | null> {
    const includeDeleted = options?.includeDeleted ?? false;
    const sql = includeDeleted
      ? 'SELECT * FROM tasks WHERE id = ?'
      : 'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL';
    const row = await this.getDb().getFirstAsync<TaskRow>(sql, [id]);
    return mapTaskRow(row);
  }

  async getByPriority(priority: TaskPriority): Promise<LocalTask[]> {
    const rows = await this.getDb().getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE priority = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [priority]
    );
    return rows.map(row => mapTaskRow(row) as LocalTask);
  }

  async update(
    id: string,
    updates: Partial<LocalTask>
  ): Promise<LocalTask | null> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deleted_at) return null;

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<LocalTask>;

    const updated: LocalTask = {
      ...existing,
      ...sanitizedUpdates,
      updated_at: new Date().toISOString(),
      version: existing.version + 1,
      synced: 0,
      deleted_at: existing.deleted_at,
    };

    await this.writeLocalTask(updated);
    const syncPayload: Record<string, unknown> = {
      id,
      ...sanitizedUpdates,
      updated_at: updated.updated_at,
      version: updated.version,
      deleted_at: updated.deleted_at,
    };
    await enqueueSyncChange({
      type: 'task',
      action: 'update',
      entityId: id,
      data: syncPayload,
      version: updated.version,
    });
    return updated;
  }

  async updateStatus(
    id: string,
    status: TaskStatus
  ): Promise<LocalTask | null> {
    return this.update(id, { status });
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deleted_at) return false;

    const now = new Date().toISOString();
    const deletedTask: LocalTask = {
      ...existing,
      deleted_at: now,
      updated_at: now,
      version: existing.version + 1,
      synced: 0,
    };

    await this.writeLocalTask(deletedTask);
    await enqueueSyncChange({
      type: 'task',
      action: 'delete',
      entityId: id,
      data: {
        id,
        deleted_at: now,
        updated_at: now,
        version: deletedTask.version,
      },
      version: deletedTask.version,
    });
    return true;
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    const result = await this.getDb().getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['last_task_sync']
    );
    return result?.value || null;
  }

  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.getDb().runAsync(
      'INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)',
      ['last_task_sync', timestamp]
    );
  }

  async resolveConflict(
    localTask: LocalTask,
    remoteTask: Task
  ): Promise<LocalTask> {
    const localTime = new Date(localTask.updated_at).getTime();
    const remoteTime = new Date(remoteTask.updated_at).getTime();
    const serverWins =
      remoteTask.version > localTask.version ||
      (remoteTask.version === localTask.version && remoteTime >= localTime);

    await recordSyncConflict({
      entityType: 'task',
      entityId: localTask.id,
      localData: localTask,
      serverData: remoteTask,
      resolution: serverWins ? 'server_wins' : 'local_wins',
    });

    if (serverWins) {
      return this.upsertFromServer(remoteTask);
    }

    return localTask;
  }
}

export const taskRepository = new TaskRepository();
