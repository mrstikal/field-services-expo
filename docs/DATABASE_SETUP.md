# Database Setup Guide

This guide covers how to set up the Supabase database with RLS policies and seed data.

## Prerequisites

- Supabase project created at [supabase.com](https://supabase.com)
- Environment variables configured (see `env.local.example`)
- `pnpm` installed

## 1. Configure Environment Variables

Copy `env.local.example` to `env.local` and fill in your Supabase credentials:

```bash
cp env.local.example env.local
```

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

## 2. Apply Row Level Security (RLS) Policies

RLS policies ensure users can only access data they are authorized to see.

### Option A: Supabase Dashboard (recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `packages/db/rls-policies.sql`
4. Paste the contents into the SQL editor
5. Click **Run**

### Option B: psql CLI

```bash
psql -U postgres -d postgres -h db.your-project.supabase.co -p 5432 -f packages/db/rls-policies.sql
```

### Verify RLS is active

Run this query in the SQL editor to confirm RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`.

## 3. Seed Demo Data

The seed script inserts demo users, tasks, reports, parts, and locations.

### Run the seed script

```bash
pnpm db:seed
```

### Demo credentials

After seeding, you can log in with:

| Role       | Email                  | Password |
|------------|------------------------|----------|
| Dispatcher | dispatcher1@demo.cz    | demo123  |
| Dispatcher | dispatcher2@demo.cz    | demo123  |
| Technician | technik1@demo.cz       | demo123  |
| Technician | technik2@demo.cz       | demo123  |
| Technician | technik3@demo.cz       | demo123  |
| Technician | technik4@demo.cz       | demo123  |
| Technician | technik5@demo.cz       | demo123  |

> **Note:** The seed script creates users in the `users` table (application data).
> You must also create matching auth users in Supabase Auth with the same emails and passwords.
> Do this via the Supabase Dashboard → Authentication → Users → Add user.

### Verify seed data

Run in SQL editor:

```sql
SELECT COUNT(*) FROM users;   -- should be 7
SELECT COUNT(*) FROM tasks;   -- should be 5
SELECT COUNT(*) FROM reports; -- should be 2
SELECT COUNT(*) FROM parts;   -- should be 5
```

## 4. Reset Demo Data

To reset the database to a clean demo state:

```bash
pnpm demo:reset
```

This runs `scripts/reset-supabase.ts` which clears and re-seeds all tables.
