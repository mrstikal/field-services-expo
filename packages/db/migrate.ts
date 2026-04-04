import { client, db, connect } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Connecting to database...');
  await connect();

  console.log('Creating tables...');

  // Create users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('technician', 'dispatcher')),
      name TEXT,
      phone TEXT,
      avatar_url TEXT,
      is_online BOOLEAN DEFAULT false,
      last_location_lat NUMERIC,
      last_location_lng NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ users table created');

  // Create tasks table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude NUMERIC NOT NULL,
      longitude NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      category TEXT NOT NULL CHECK (category IN ('repair', 'installation', 'maintenance', 'inspection')),
      due_date TIMESTAMPTZ NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      estimated_time INTEGER NOT NULL,
      technician_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ tasks table created');

  // Create reports table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'synced')),
      photos TEXT[] NOT NULL DEFAULT '{}',
      form_data JSONB NOT NULL DEFAULT '{}',
      signature TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ reports table created');

  // Create locations table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technician_id UUID NOT NULL REFERENCES users(id),
      latitude NUMERIC NOT NULL,
      longitude NUMERIC NOT NULL,
      accuracy NUMERIC NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ locations table created');

  // Create parts table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS parts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      barcode TEXT NOT NULL UNIQUE,
      price NUMERIC NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ parts table created');

  // Create sync_queue table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('task', 'report', 'location')),
      action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
      data JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ sync_queue table created');

  console.log('All tables created successfully!');
  await client.end();
}

main().catch((err) => {
  console.error('Error creating tables:', err);
  process.exit(1);
});
