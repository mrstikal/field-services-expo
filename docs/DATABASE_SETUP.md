# Database Setup Guide

This project uses Supabase PostgreSQL with RLS enforced from `public.users.role`.

## Prerequisites

- Supabase project
- `env.local` created from `env.local.example`
- `pnpm` installed

## 1. Configure Environment Variables

Copy the template and fill in the Supabase values:

```bash
cp env.local.example env.local
```

Required variables used by the current scripts:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

For Next.js client usage, expose the matching public variables if your local setup requires them.

## 2. Apply Schema Changes

Apply the Drizzle schema/migrations first:

```bash
pnpm db:migrate
```

The current schema includes:

- `users.id` aligned to Supabase Auth user IDs
- `tasks.deleted_at` and `reports.deleted_at` tombstones for sync deletions
- `reports.pdf_url`

## 3. Apply Row Level Security

RLS policies live in `packages/db/rls-policies.sql`.

### Option A: Supabase Dashboard

1. Open Supabase Dashboard.
2. Go to **SQL Editor**.
3. Paste `packages/db/rls-policies.sql`.
4. Run it.

### Option B: psql

```bash
psql -U postgres -d postgres -h db.your-project.supabase.co -p 5432 -f packages/db/rls-policies.sql
```

### Verify RLS

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All application tables should report `rowsecurity = true`.

## 4. Reset Demo Data

For a clean demo environment, use:

```bash
pnpm demo:reset
```

This script:

- creates or updates demo users in Supabase Auth
- recreates matching rows in `public.users`
- seeds demo tasks, reports, parts, and locations
- ensures `pdf_url` and tombstone columns exist

`pnpm demo:reset` is the recommended path for Supabase-backed development because it keeps `auth.users.id` and `public.users.id` aligned.

## 5. Local Seed Only

If you only want to seed through Drizzle without touching Supabase Auth:

```bash
pnpm db:seed
```

This inserts the same deterministic demo IDs into the database, but it does not create Auth users. Use it only in environments where auth is managed separately.

## 6. Demo Credentials

After `pnpm demo:reset`, these accounts are ready:

| Role       | Email               | Password |
| ---------- | ------------------- | -------- |
| Dispatcher | dispatcher1@demo.cz | demo123  |
| Dispatcher | dispatcher2@demo.cz | demo123  |
| Technician | technik1@demo.cz    | demo123  |
| Technician | technik2@demo.cz    | demo123  |
| Technician | technik3@demo.cz    | demo123  |
| Technician | technik4@demo.cz    | demo123  |
| Technician | technik5@demo.cz    | demo123  |

## 7. Verify Demo Data

Run in Supabase SQL editor:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM reports WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM parts;
SELECT COUNT(*) FROM locations;
```
