export * from './schema';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/field_service';

export const client = new Client({ connectionString });

export async function connect() {
  await client.connect();
  console.log('Connected to PostgreSQL database');
}

export const db = drizzle(client);