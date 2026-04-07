export * from './schema';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

let client: Client | null = null;
let isConnected = false;

export function getClient(): Client {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set.');
    }
    client = new Client({ connectionString });
  }
  return client;
}

export async function connect() {
  const c = getClient();
  if (!isConnected) {
    await c.connect();
    isConnected = true;
    console.log('Connected to PostgreSQL database');
  }
}

export const db = drizzle(getClient());
