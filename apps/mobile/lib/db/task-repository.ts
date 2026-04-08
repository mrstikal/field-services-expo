import { getDatabase } from './local-database';
import { Task, TaskStatus, TaskPriority } from '@shared/index';
import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Task Repository - Local database operations for tasks
 * Implements offline-first pattern with sync queue integration
 */
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

  // ==================== CREATE ====================

   /**
    * Create a new task locally
    * Automatically adds to sync_queue for later sync
    */
    async create(task: Omit<Task, 'created_at' | 'updated_at' | 'version' | 'synced'>): Promise<Task> {
      const now = new Date().toISOString();
      const id = (task as Omit<Task, 'created_at' | 'updated_at' | 'version' | 'synced'> & { id?: string }).id || crypto.randomUUID();
     const version = 1;

     const newTask: Task = {
       ...task,
       id,
       created_at: now,
       updated_at: now,
       version,
       synced: 0,
     } as Task;

     // Insert task
     await this.getDb().runAsync(
       `INSERT INTO tasks (
         id, title, description, address, latitude, longitude,
         status, priority, category, due_date, customer_name,
         customer_phone, estimated_time, technician_id, created_at, updated_at, version, synced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
       [
         newTask.id,
         newTask.title,
         newTask.description,
         newTask.address,
         newTask.latitude,
         newTask.longitude,
         newTask.status,
         newTask.priority,
         newTask.category,
         newTask.due_date,
         newTask.customer_name,
         newTask.customer_phone,
         newTask.estimated_time,
         newTask.technician_id,
         newTask.created_at,
         newTask.updated_at,
         newTask.version,
         newTask.synced,
       ]
     );

     // Add to sync queue
     await this.addToSyncQueue('task', 'create', newTask, version);

     return newTask;
   }
   
   /**
    * Create or update a task from server data (without adding to sync queue)
    * Used during pull sync to avoid creating duplicate sync queue entries
    */
   async upsertFromServer(task: Task): Promise<Task> {
     const now = new Date().toISOString();
     const id = task.id || crypto.randomUUID();

     const taskToInsert: Task = {
       ...task,
       id,
       created_at: task.created_at || now,
       updated_at: task.updated_at || now,
       version: task.version || 1, // Preserve server version
       synced: task.synced !== undefined ? task.synced : 0,
     };

     // Upsert task (update if exists, insert if not)
     // Check if task exists first
     const existingTask = await this.getById(taskToInsert.id);
     if (existingTask) {
       // Update existing task with server data (preserving server version and timestamps)
       await this.getDb().runAsync(
         `UPDATE tasks SET
           title = ?,
           description = ?,
           address = ?,
           latitude = ?,
           longitude = ?,
           status = ?,
           priority = ?,
           category = ?,
           due_date = ?,
           customer_name = ?,
           customer_phone = ?,
           estimated_time = ?,
           technician_id = ?,
           updated_at = ?,  -- Use server timestamp
           version = ?      -- Use server version
         WHERE id = ?`,
         [
           taskToInsert.title,
           taskToInsert.description,
           taskToInsert.address,
           taskToInsert.latitude,
           taskToInsert.longitude,
           taskToInsert.status,
           taskToInsert.priority,
           taskToInsert.category,
           taskToInsert.due_date,
           taskToInsert.customer_name,
           taskToInsert.customer_phone,
           taskToInsert.estimated_time,
           taskToInsert.technician_id,
           taskToInsert.updated_at,
           taskToInsert.version,
           taskToInsert.id
         ]
       );
     } else {
       // Insert new task
       await this.getDb().runAsync(
         `INSERT INTO tasks (
           id, title, description, address, latitude, longitude,
           status, priority, category, due_date, customer_name,
           customer_phone, estimated_time, technician_id, created_at, updated_at, version, synced
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [
           taskToInsert.id,
           taskToInsert.title,
           taskToInsert.description,
           taskToInsert.address,
           taskToInsert.latitude,
           taskToInsert.longitude,
           taskToInsert.status,
           taskToInsert.priority,
           taskToInsert.category,
           taskToInsert.due_date,
           taskToInsert.customer_name,
           taskToInsert.customer_phone,
           taskToInsert.estimated_time,
           taskToInsert.technician_id,
           taskToInsert.created_at,
           taskToInsert.updated_at,
           taskToInsert.version,
           taskToInsert.synced,
         ]
       );
     }

     // Do NOT add to sync queue - this is server data, not local changes

     return taskToInsert;
   }

  // ==================== READ ====================

  /**
   * Get all tasks
   */
  async getAll(): Promise<Task[]> {
    return this.getDb().getAllAsync<Task>(
      `SELECT * FROM tasks ORDER BY created_at DESC`
    );
  }

  /**
   * Get tasks by status
   */
  async getByStatus(status: TaskStatus): Promise<Task[]> {
    return this.getDb().getAllAsync<Task>(
      `SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
  }

  /**
   * Get tasks by technician
   */
  async getByTechnician(technicianId: string): Promise<Task[]> {
    return this.getDb().getAllAsync<Task>(
      `SELECT * FROM tasks WHERE technician_id = ? ORDER BY created_at DESC`,
      [technicianId]
    );
  }

  /**
   * Get task by ID
   */
  async getById(id: string): Promise<Task | null> {
    return this.getDb().getFirstAsync<Task>(
      `SELECT * FROM tasks WHERE id = ?`,
      [id]
    );
  }

  /**
   * Get tasks by priority
   */
  async getByPriority(priority: TaskPriority): Promise<Task[]> {
    return this.getDb().getAllAsync<Task>(
      `SELECT * FROM tasks WHERE priority = ? ORDER BY created_at DESC`,
      [priority]
    );
  }

  // ==================== UPDATE ====================

  /**
   * Update an existing task
   * Automatically increments version and adds to sync queue
   */
  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const version = existing.version + 1;

     // Build update query dynamically
     const updateFields: string[] = [];
     const params: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.address !== undefined) {
      updateFields.push('address = ?');
      params.push(updates.address);
    }
    if (updates.latitude !== undefined) {
      updateFields.push('latitude = ?');
      params.push(updates.latitude);
    }
    if (updates.longitude !== undefined) {
      updateFields.push('longitude = ?');
      params.push(updates.longitude);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      params.push(updates.category);
    }
    if (updates.due_date !== undefined) {
      updateFields.push('due_date = ?');
      params.push(updates.due_date);
    }
    if (updates.customer_name !== undefined) {
      updateFields.push('customer_name = ?');
      params.push(updates.customer_name);
    }
    if (updates.customer_phone !== undefined) {
      updateFields.push('customer_phone = ?');
      params.push(updates.customer_phone);
    }
    if (updates.estimated_time !== undefined) {
      updateFields.push('estimated_time = ?');
      params.push(updates.estimated_time);
    }
    if (updates.technician_id !== undefined) {
      updateFields.push('technician_id = ?');
      params.push(updates.technician_id);
    }

    updateFields.push('updated_at = ?');
    updateFields.push('version = ?');
    params.push(now);
    params.push(version);

    params.push(id);

    await this.getDb().runAsync(
      `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    // Get updated task
    const updated = await this.getById(id);

    if (updated) {
      // Add to sync queue
      await this.addToSyncQueue('task', 'update', updated, version);
    }

    return updated;
  }

  /**
   * Update task status (convenience method)
   */
  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    return this.update(id, { status });
  }

  // ==================== DELETE ====================

  /**
   * Delete a task
   * Adds to sync queue for server-side deletion
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    await this.getDb().runAsync(`DELETE FROM tasks WHERE id = ?`, [id]);

    // Add to sync queue for server-side deletion
    await this.addToSyncQueue('task', 'delete', { id }, existing.version);

    return true;
  }

  // ==================== SYNC QUEUE ====================

   /**
    * Add task to sync queue
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
      ['last_task_sync']
    );
    return result?.value || null;
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.getDb().runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)`,
      ['last_task_sync', timestamp]
    );
  }

  // ==================== CONFLICT RESOLUTION ====================

  /**
   * Resolve sync conflict using "last write wins"
   * Returns the winning record
   */
  async resolveConflict(localTask: Task, remoteTask: Task): Promise<Task> {
    // Compare versions
    if (remoteTask.version > localTask.version) {
      // Remote wins
      await this.update(localTask.id, remoteTask);
      return remoteTask;
    } else if (localTask.version > remoteTask.version) {
      // Local wins - update remote version
      await this.update(localTask.id, { version: localTask.version });
      return localTask;
    } else {
      // Same version - compare timestamps
      const localTime = new Date(localTask.updated_at).getTime();
      const remoteTime = new Date(remoteTask.updated_at).getTime();

      if (remoteTime > localTime) {
        await this.update(localTask.id, remoteTask);
        return remoteTask;
      } else {
        await this.update(localTask.id, { version: localTask.version });
        return localTask;
      }
    }
  }
}

// Singleton instance
export const taskRepository = new TaskRepository();