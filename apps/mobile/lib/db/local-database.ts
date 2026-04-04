import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const DATABASE_NAME = 'field-service.db';
const DATABASE_VERSION = 1;

// SQLite database instance
let db: SQLiteDatabase | null = null;

// Database initialization
export async function initDatabase() {
  try {
    // Check if database exists
    const dbPath = `${FileSystem.documentDirectory}sqlite/${DATABASE_NAME}`;
    const exists = await FileSystem.getInfoAsync(dbPath);

    if (!exists.exists) {
      // Create directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}sqlite`, { intermediates: true });
      
      // Copy pre-populated database if exists (optional for future)
      // For now, we'll create the schema from scratch
    }

    // Open database
    db = await openDatabaseAsync(DATABASE_NAME);

    // Run migrations
    await runMigrations();

    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Run schema migrations
async function runMigrations() {
  if (!db) return;

  // Get current version
  const version = await getCurrentVersion();

  if (version < DATABASE_VERSION) {
    // Apply migrations
    await db.execAsync(`
      -- Migration 1: Initial schema
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'assigned',
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL,
        due_date TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        estimated_time INTEGER NOT NULL,
        technician_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        photos TEXT NOT NULL DEFAULT '[]',
        form_data TEXT NOT NULL DEFAULT '{}',
        signature TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

       CREATE TABLE IF NOT EXISTS sync_queue (
         id TEXT PRIMARY KEY,
         type TEXT NOT NULL,
         action TEXT NOT NULL,
         data TEXT NOT NULL,
         version INTEGER NOT NULL DEFAULT 1,
         status TEXT NOT NULL DEFAULT 'pending',
         error TEXT,
         retry_count INTEGER DEFAULT 0,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        technician_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        barcode TEXT NOT NULL UNIQUE,
        price REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cached_assets (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        local_path TEXT NOT NULL,
        remote_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_technician ON tasks(technician_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type);
      CREATE INDEX IF NOT EXISTS idx_reports_task ON reports(task_id);
    `);

    // Update version
    await db.runAsync('INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)', ['schema_version', DATABASE_VERSION.toString()]);
  }
}

// Get current schema version
async function getCurrentVersion(): Promise<number> {
  if (!db) return 0;

  try {
    const result = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['schema_version']
    );
    return result ? parseInt(result.value, 10) : 0;
  } catch {
    return 0;
  }
}

// Get database instance
export function getDatabase(): SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Close database
export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// Reset database (for testing/debugging)
export async function resetDatabase() {
  if (!db) return;

  await db.execAsync(`
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS reports;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS sync_metadata;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS parts;
    DROP TABLE IF EXISTS cached_assets;
  `);

  // Re-run migrations
  await runMigrations();
}