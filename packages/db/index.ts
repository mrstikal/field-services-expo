export * from './schema';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/field_service';

export const client = new Client({ connectionString });

let isConnected = false;

export async function connect() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log('Connected to PostgreSQL database');
  }
}

export const db = drizzle(client);