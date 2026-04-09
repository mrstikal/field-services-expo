import { getDatabase } from './local-database';
import type { Location } from '@field-service/shared-types';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  clearPendingChangesForEntity,
  enqueueSyncChange,
  emitSyncEvent,
} from '@/lib/sync/sync-events';
import { generateId } from '@/lib/utils/generate-id';

export class LocationRepository {
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

  async saveDeviceLocation(
    input: Omit<Location, 'id' | 'created_at'> & { id?: string }
  ): Promise<Location> {
    const createdAt = new Date().toISOString();
    const location: Location = {
      ...input,
      id: input.id || generateId(),
      created_at: createdAt,
    };

    await this.getDb().runAsync(
      `INSERT INTO locations (id, technician_id, latitude, longitude, accuracy, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        location.id,
        location.technician_id,
        location.latitude,
        location.longitude,
        location.accuracy,
        location.timestamp,
        createdAt,
      ]
    );

    await enqueueSyncChange({
      type: 'location',
      action: 'create',
      entityId: location.id,
      data: location,
      version: null,
    });

    return location;
  }

  async upsertFromServer(location: Location): Promise<void> {
    const createdAt = location.created_at ?? new Date().toISOString();

    await this.getDb().runAsync(
      `INSERT OR REPLACE INTO locations (id, technician_id, latitude, longitude, accuracy, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        location.id,
        location.technician_id,
        location.latitude,
        location.longitude,
        location.accuracy,
        location.timestamp,
        createdAt,
      ]
    );

    await clearPendingChangesForEntity('location', location.id);
    emitSyncEvent();
  }
}

export const locationRepository = new LocationRepository();
