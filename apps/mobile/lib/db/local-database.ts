import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

const DATABASE_NAME = 'field-service.db';
const DATABASE_VERSION = 6;

let db: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

function logDatabaseStep(step: string) {
  console.log(`[db] ${step}`);
}

async function executeStatements(
  database: SQLiteDatabase,
  statements: string[]
) {
  for (const statement of statements) {
    await database.execAsync(statement);
  }
}

export async function initDatabase() {
  if (db) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      logDatabaseStep('opening database');
      const dbPath = `${FileSystem.documentDirectory}sqlite/${DATABASE_NAME}`;
      const exists = await FileSystem.getInfoAsync(dbPath);

      if (!exists.exists) {
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}sqlite`,
          { intermediates: true }
        );
      }

      const database = await openDatabaseAsync(DATABASE_NAME);
      logDatabaseStep('running migrations');
      await runMigrations(database);
      db = database;
      logDatabaseStep('database ready');
      return database;
    } catch (error) {
      db = null;
      console.error('Error initializing database:', error);
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

async function ensureMetadataTable(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function runMigration1(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
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
      pdf_url TEXT,
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
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      version INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_technician ON tasks(technician_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_id);
    CREATE INDEX IF NOT EXISTS idx_reports_task ON reports(task_id);
  `);
}

async function runMigration2(database: SQLiteDatabase) {
  await database
    .execAsync(
      `
    ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
    ALTER TABLE reports ADD COLUMN deleted_at TEXT;
  `
    )
    .catch(() => undefined);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      local_data TEXT NOT NULL,
      server_data TEXT NOT NULL,
      resolution TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id);
  `);
}

async function runMigration3(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports(deleted_at);
  `);
}

async function getTableColumns(
  database: SQLiteDatabase,
  tableName: string
): Promise<string[]> {
  const rows =
    (await database.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${tableName})`
    )) ?? [];
  return rows.map(row => row.name);
}

function pickColumn(columns: string[], ...candidates: string[]) {
  return candidates.find(candidate => columns.includes(candidate)) ?? null;
}

async function rebuildSyncQueueTable(
  database: SQLiteDatabase,
  existingColumns: string[]
) {
  const entityIdColumn = pickColumn(
    existingColumns,
    'entity_id',
    'entityId',
    'record_id',
    'recordId'
  );
  const retryCountColumn = pickColumn(
    existingColumns,
    'retry_count',
    'retryCount'
  );
  const createdAtColumn = pickColumn(
    existingColumns,
    'created_at',
    'createdAt'
  );
  const updatedAtColumn = pickColumn(
    existingColumns,
    'updated_at',
    'updatedAt'
  );

  const entityIdExpression = entityIdColumn ? `"${entityIdColumn}"` : 'id';
  const retryCountExpression = retryCountColumn ? `"${retryCountColumn}"` : '0';
  const createdAtExpression = createdAtColumn
    ? `"${createdAtColumn}"`
    : 'CURRENT_TIMESTAMP';
  const updatedAtExpression = updatedAtColumn
    ? `"${updatedAtColumn}"`
    : createdAtColumn
      ? `"${createdAtColumn}"`
      : 'CURRENT_TIMESTAMP';

  logDatabaseStep(
    `rebuilding sync_queue table from columns: ${existingColumns.join(', ')}`
  );
  await executeStatements(database, [
    'ALTER TABLE sync_queue RENAME TO sync_queue_legacy',
    `CREATE TABLE sync_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      version INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `INSERT INTO sync_queue (id, type, action, entity_id, data, version, status, error, retry_count, created_at, updated_at)
    SELECT
      id,
      type,
      action,
      ${entityIdExpression},
      data,
      version,
      COALESCE(status, 'pending'),
      error,
      ${retryCountExpression},
      ${createdAtExpression},
      ${updatedAtExpression}
    FROM sync_queue_legacy`,
    'DROP TABLE sync_queue_legacy',
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type)',
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_id)',
  ]);
}

async function rebuildSyncConflictsTable(
  database: SQLiteDatabase,
  existingColumns: string[]
) {
  const entityTypeColumn = pickColumn(
    existingColumns,
    'entity_type',
    'entityType',
    'type'
  );
  const entityIdColumn = pickColumn(
    existingColumns,
    'entity_id',
    'entityId',
    'record_id',
    'recordId'
  );
  const localDataColumn = pickColumn(
    existingColumns,
    'local_data',
    'localData'
  );
  const serverDataColumn = pickColumn(
    existingColumns,
    'server_data',
    'serverData'
  );
  const createdAtColumn = pickColumn(
    existingColumns,
    'created_at',
    'createdAt'
  );
  const resolvedAtColumn = pickColumn(
    existingColumns,
    'resolved_at',
    'resolvedAt',
    'updated_at',
    'updatedAt'
  );

  logDatabaseStep(
    `rebuilding sync_conflicts table from columns: ${existingColumns.join(', ')}`
  );
  await executeStatements(database, [
    'ALTER TABLE sync_conflicts RENAME TO sync_conflicts_legacy',
    `CREATE TABLE sync_conflicts (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      local_data TEXT NOT NULL,
      server_data TEXT NOT NULL,
      resolution TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT NOT NULL
    )`,
    `INSERT INTO sync_conflicts (id, entity_type, entity_id, local_data, server_data, resolution, created_at, resolved_at)
    SELECT
      id,
      ${entityTypeColumn ? `"${entityTypeColumn}"` : "'unknown'"},
      ${entityIdColumn ? `"${entityIdColumn}"` : 'id'},
      ${localDataColumn ? `"${localDataColumn}"` : "'{}'"},
      ${serverDataColumn ? `"${serverDataColumn}"` : "'{}'"},
      COALESCE(resolution, 'server_wins'),
      ${createdAtColumn ? `"${createdAtColumn}"` : 'CURRENT_TIMESTAMP'},
      ${resolvedAtColumn ? `"${resolvedAtColumn}"` : createdAtColumn ? `"${createdAtColumn}"` : 'CURRENT_TIMESTAMP'}
    FROM sync_conflicts_legacy`,
    'DROP TABLE sync_conflicts_legacy',
    'CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id)',
  ]);
}

async function runMigration4(database: SQLiteDatabase) {
  logDatabaseStep('checking migration 4');
  const syncQueueColumns = await getTableColumns(database, 'sync_queue');
  const requiredSyncQueueColumns = [
    'id',
    'type',
    'action',
    'entity_id',
    'data',
    'version',
    'status',
    'error',
    'retry_count',
    'created_at',
    'updated_at',
  ];

  if (
    syncQueueColumns.length > 0 &&
    requiredSyncQueueColumns.some(column => !syncQueueColumns.includes(column))
  ) {
    await rebuildSyncQueueTable(database, syncQueueColumns);
  }

  const syncConflictColumns = await getTableColumns(database, 'sync_conflicts');
  const requiredSyncConflictColumns = [
    'id',
    'entity_type',
    'entity_id',
    'local_data',
    'server_data',
    'resolution',
    'created_at',
    'resolved_at',
  ];

  if (
    syncConflictColumns.length > 0 &&
    requiredSyncConflictColumns.some(
      column => !syncConflictColumns.includes(column)
    )
  ) {
    await rebuildSyncConflictsTable(database, syncConflictColumns);
  }
}

async function runMigration5(database: SQLiteDatabase) {
  logDatabaseStep('checking migration 5');
  const reportColumns = await getTableColumns(database, 'reports');

  if (reportColumns.length === 0) {
    return;
  }

  const statements: string[] = [];

  if (!reportColumns.includes('signature')) {
    statements.push('ALTER TABLE reports ADD COLUMN signature TEXT');
  }

  if (!reportColumns.includes('pdf_url')) {
    statements.push('ALTER TABLE reports ADD COLUMN pdf_url TEXT');
  }

  if (!reportColumns.includes('deleted_at')) {
    statements.push('ALTER TABLE reports ADD COLUMN deleted_at TEXT');
  }

  if (!reportColumns.includes('version')) {
    statements.push(
      'ALTER TABLE reports ADD COLUMN version INTEGER NOT NULL DEFAULT 1'
    );
  }

  if (!reportColumns.includes('synced')) {
    statements.push(
      'ALTER TABLE reports ADD COLUMN synced INTEGER NOT NULL DEFAULT 0'
    );
  }

  if (statements.length > 0) {
    logDatabaseStep(
      `patching reports table columns: ${statements.length} statement(s)`
    );
    await executeStatements(database, statements);
  }
}

async function runMigrations(database: SQLiteDatabase) {
  await ensureMetadataTable(database);
  const version = await getCurrentVersion(database);
  logDatabaseStep(`current schema version: ${version}`);

  if (version > DATABASE_VERSION) {
    throw new Error(
      `Unsupported database version ${version}. Expected at most ${DATABASE_VERSION}.`
    );
  }

  if (version < 1) {
    await runMigration1(database);
    await setSchemaVersion(database, 1);
  }

  if (version < 2) {
    await runMigration2(database);
    await setSchemaVersion(database, 2);
  }

  if (version < 3) {
    await runMigration3(database);
    await setSchemaVersion(database, 3);
  }

  if (version < 4) {
    await runMigration4(database);
    await setSchemaVersion(database, 4);
  }

  if (version < 5) {
    await runMigration5(database);
    await setSchemaVersion(database, 5);
  }

  if (version < 6) {
    await runMigration6(database);
    await setSchemaVersion(database, 6);
  }
}

async function runMigration6(database: SQLiteDatabase) {
  logDatabaseStep('checking migration 6 - adding messaging tables');
  
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      edited_at TEXT,
      deleted_at TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (message_id) REFERENCES messages(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reads_message_user ON message_reads(message_id, user_id);
  `);
}

async function setSchemaVersion(database: SQLiteDatabase, version: number) {
  await database.runAsync(
    'INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)',
    ['schema_version', version.toString()]
  );
}

async function getCurrentVersion(database: SQLiteDatabase): Promise<number> {
  await ensureMetadataTable(database);

  try {
    const result = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['schema_version']
    );
    return result ? Number.parseInt(result.value, 10) : 0;
  } catch {
    return 0;
  }
}

export function getDatabase(): SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  initPromise = null;
}

export async function clearAllTables(database: SQLiteDatabase) {
  await database.execAsync(`
    DROP TABLE IF EXISTS message_reads;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS reports;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS sync_conflicts;
    DROP TABLE IF EXISTS sync_metadata;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS parts;
    DROP TABLE IF EXISTS cached_assets;
  `);

  await runMigrations(database);
}

export async function getTestDatabase(): Promise<SQLiteDatabase> {
  const testDb = await openDatabaseAsync(':memory:');
  await clearAllTables(testDb);
  return testDb;
}
