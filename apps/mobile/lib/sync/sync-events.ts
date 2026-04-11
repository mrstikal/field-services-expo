import { getDatabase } from '@/lib/db/local-database';
import { generateId } from '@/lib/utils/generate-id';

export type SyncEventListener = () => void;

const listeners = new Set<SyncEventListener>();

export function subscribeToSyncEvents(listener: SyncEventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSyncEvent() {
  listeners.forEach(listener => listener());
}

export async function enqueueSyncChange(change: {
  type:
    | 'task'
    | 'report'
    | 'location'
    | 'conversation'
    | 'message'
    | 'message_read';
  action: 'create' | 'update' | 'delete';
  entityId: string;
  data: Record<string, unknown>;
  version?: number | null;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue (id, type, action, entity_id, data, version, status, retry_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    [
      generateId(),
      change.type,
      change.action,
      change.entityId,
      JSON.stringify(change.data),
      change.version ?? null,
      now,
      now,
    ]
  );

  emitSyncEvent();
}

export async function clearPendingChangesForEntity(
  entityType:
    | 'task'
    | 'report'
    | 'location'
    | 'conversation'
    | 'message'
    | 'message_read',
  entityId: string
) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE type = ? AND entity_id = ?', [
    entityType,
    entityId,
  ]);
  emitSyncEvent();
}

export async function hasPendingChangesForEntity(
  entityType:
    | 'task'
    | 'report'
    | 'location'
    | 'conversation'
    | 'message'
    | 'message_read',
  entityId: string
) {
  const db = getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE type = ? AND entity_id = ? AND status IN ('pending', 'failed')`,
    [entityType, entityId]
  );

  return (result?.count ?? 0) > 0;
}

export async function recordSyncConflict(conflict: {
  entityType:
    | 'task'
    | 'report'
    | 'location'
    | 'conversation'
    | 'message'
    | 'message_read';
  entityId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolution: 'server_wins' | 'local_wins';
}) {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_conflicts (id, entity_type, entity_id, local_data, server_data, resolution, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      conflict.entityType,
      conflict.entityId,
      JSON.stringify(conflict.localData),
      JSON.stringify(conflict.serverData),
      conflict.resolution,
      now,
      now,
    ]
  );
}
