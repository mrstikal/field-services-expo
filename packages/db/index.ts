export * from './schema';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ensureServerEnvLoaded, getDatabaseUrl } from './env';

type DbState = {
  pool?: Pool;
  connectPromise?: Promise<void>;
};

const globalForDb = globalThis as typeof globalThis & {
  __fieldServiceDbState__?: DbState;
};

const dbState =
  globalForDb.__fieldServiceDbState__ ??
  (globalForDb.__fieldServiceDbState__ = {});

ensureServerEnvLoaded();

export function getClient(): Pool {
  if (!dbState.pool) {
    const connectionString = getDatabaseUrl();
    dbState.pool = new Pool({ connectionString });
  }

  return dbState.pool;
}

export async function connect() {
  if (!dbState.connectPromise) {
    dbState.connectPromise = getClient()
      .query('SELECT 1')
      .then(() => {
        console.log('Connected to PostgreSQL database');
      })
      .catch(error => {
        dbState.connectPromise = undefined;
        throw error;
      });
  }

  await dbState.connectPromise;
}

export const db = drizzle(getClient());
