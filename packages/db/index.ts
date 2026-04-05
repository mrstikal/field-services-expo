export * from './schema';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Please configure it in env.local');
}

const connectionString = process.env.DATABASE_URL;

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