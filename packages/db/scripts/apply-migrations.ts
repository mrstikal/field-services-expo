import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const rootDir = path.resolve(__dirname, '../../..');
const envPath = path.join(rootDir, 'env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

type Candidate = {
  name: string;
  connectionString: string;
};

function withSslModeRequire(connectionString: string) {
  const url = new URL(connectionString);
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }
  return url.toString();
}

function getProjectRefFromSupabaseUrl() {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const host = new URL(supabaseUrl).hostname;
    return host.split('.')[0] ?? null;
  } catch {
    return null;
  }
}

function buildCandidates(): Candidate[] {
  const candidates: Candidate[] = [];
  const databaseUrl = process.env.DATABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  let passwordFromDatabaseUrl: string | null = null;
  const projectRef = getProjectRefFromSupabaseUrl();
  const poolerHostFromEnv = process.env.SUPABASE_DB_POOLER_HOST;

  if (databaseUrl) {
    candidates.push({
      name: 'DATABASE_URL',
      connectionString: databaseUrl,
    });
    candidates.push({
      name: 'DATABASE_URL + sslmode=require',
      connectionString: withSslModeRequire(databaseUrl),
    });

    try {
      const parsed = new URL(databaseUrl);
      passwordFromDatabaseUrl = parsed.password || null;
    } catch {
      passwordFromDatabaseUrl = null;
    }
  }

  const effectivePassword = dbPassword || passwordFromDatabaseUrl;

  if (effectivePassword && projectRef) {
    const encoded = encodeURIComponent(effectivePassword);
    candidates.push({
      name: 'SUPABASE DB password direct',
      connectionString: `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`,
    });
    candidates.push({
      name: 'SUPABASE DB password pooler (eu-west-1)',
      connectionString: `postgresql://postgres.${projectRef}:${encoded}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`,
    });
    if (poolerHostFromEnv) {
      candidates.push({
        name: 'SUPABASE DB password pooler (env host)',
        connectionString: `postgresql://postgres.${projectRef}:${encoded}@${poolerHostFromEnv}:6543/postgres?sslmode=require`,
      });
    }
  }

  return candidates;
}

async function tryConnect(candidate: Candidate) {
  const pool = new Pool({
    connectionString: candidate.connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 8000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('select 1');
    } finally {
      client.release();
    }
    return { ok: true as const };
  } catch (error) {
    const err = error as {
      code?: string;
      message?: string;
    };
    return {
      ok: false as const,
      code: err.code ?? 'UNKNOWN',
      message: err.message ?? 'Unknown error',
    };
  } finally {
    await pool.end();
  }
}

async function applyMigrations() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const candidates = buildCandidates();
  if (candidates.length === 0) {
    throw new Error(
      'No DB connection candidate found. Set DATABASE_URL or SUPABASE_DB_PASSWORD + SUPABASE_URL in env.local.'
    );
  }

  let selected: Candidate | null = null;
  const failures: Array<{ name: string; code: string; message: string }> = [];

  for (const candidate of candidates) {
    const result = await tryConnect(candidate);
    if (result.ok) {
      selected = candidate;
      break;
    }

    failures.push({
      name: candidate.name,
      code: result.code,
      message: result.message,
    });
  }

  if (!selected) {
    const formatted = failures
      .map(failure => `- ${failure.name}: ${failure.code} ${failure.message}`)
      .join('\n');
    throw new Error(`Unable to connect to database using any candidate:\n${formatted}`);
  }

  console.log(`Using DB connection candidate: ${selected.name}`);

  const pool = new Pool({
    connectionString: selected.connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(__dirname, '../migrations');

    console.log(`Applying Drizzle migrations from: ${migrationsFolder}`);
    try {
      await migrate(db, { migrationsFolder });
      console.log('Migrations applied successfully.');
    } catch (error) {
      const err = error as {
        cause?: { code?: string; message?: string };
        message?: string;
      };
      const code = err.cause?.code;

      // Existing demo projects may already contain core tables without
      // drizzle migration history; apply idempotent messaging patch instead
      // of failing hard on "relation already exists".
      if (code === '42P07' || code === '42701') {
        console.warn(
          `Drizzle baseline conflict detected (${code}). Applying idempotent messaging schema patch...`
        );
        await applyIdempotentMessagingPatch(pool);
        await markInitialMigrationAsApplied(pool, migrationsFolder);
        console.log('Idempotent schema patch applied successfully.');
      } else {
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

async function applyIdempotentMessagingPatch(pool: Pool) {
  await pool.query(`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS expo_push_token text;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user1_id uuid NOT NULL,
      user2_id uuid NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      conversation_id uuid NOT NULL,
      sender_id uuid NOT NULL,
      content text NOT NULL,
      sent_at timestamp DEFAULT now() NOT NULL,
      edited_at timestamp,
      deleted_at timestamp
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.message_reads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      message_id uuid NOT NULL,
      user_id uuid NOT NULL,
      read_at timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversations_user1_id_users_id_fk'
      ) THEN
        ALTER TABLE public.conversations
        ADD CONSTRAINT conversations_user1_id_users_id_fk
        FOREIGN KEY (user1_id) REFERENCES public.users(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversations_user2_id_users_id_fk'
      ) THEN
        ALTER TABLE public.conversations
        ADD CONSTRAINT conversations_user2_id_users_id_fk
        FOREIGN KEY (user2_id) REFERENCES public.users(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'messages_conversation_id_conversations_id_fk'
      ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT messages_conversation_id_conversations_id_fk
        FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'messages_sender_id_users_id_fk'
      ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT messages_sender_id_users_id_fk
        FOREIGN KEY (sender_id) REFERENCES public.users(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_reads_message_id_messages_id_fk'
      ) THEN
        ALTER TABLE public.message_reads
        ADD CONSTRAINT message_reads_message_id_messages_id_fk
        FOREIGN KEY (message_id) REFERENCES public.messages(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_reads_user_id_users_id_fk'
      ) THEN
        ALTER TABLE public.message_reads
        ADD CONSTRAINT message_reads_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id);
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_user1_user2_idx
    ON public.conversations (user1_id, user2_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS messages_conversation_idx
    ON public.messages (conversation_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS messages_sender_idx
    ON public.messages (sender_id);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS message_reads_message_user_idx
    ON public.message_reads (message_id, user_id);
  `);
}

async function markInitialMigrationAsApplied(pool: Pool, migrationsFolder: string) {
  const migrationFile = path.join(migrationsFolder, '0000_deep_mach_iv.sql');
  const journalFile = path.join(migrationsFolder, 'meta/_journal.json');

  if (!fs.existsSync(migrationFile) || !fs.existsSync(journalFile)) {
    return;
  }

  const sqlText = fs.readFileSync(migrationFile, 'utf8');
  const hash = crypto.createHash('sha256').update(sqlText).digest('hex');

  const journal = JSON.parse(fs.readFileSync(journalFile, 'utf8')) as {
    entries?: Array<{ tag: string; when: number }>;
  };
  const entry = journal.entries?.find(item => item.tag === '0000_deep_mach_iv');
  const createdAt = entry?.when ?? Date.now();

  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  await pool.query(
    `
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1
      )
    `,
    [hash, createdAt]
  );
}

applyMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
