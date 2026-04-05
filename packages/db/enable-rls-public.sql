-- Re-enable RLS with public access for demo/testing
-- This version allows public SELECT access while keeping authenticated-only for modifications

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can view all reports" ON reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON reports;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON reports;
DROP POLICY IF EXISTS "Authenticated users can view all locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can update locations" ON locations;
DROP POLICY IF EXISTS "Everyone can view parts" ON parts;
DROP POLICY IF EXISTS "Authenticated users can create parts" ON parts;
DROP POLICY IF EXISTS "Authenticated users can update parts" ON parts;
DROP POLICY IF EXISTS "Authenticated users can delete parts" ON parts;
DROP POLICY IF EXISTS "Users can view own sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can insert own sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can update own sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can delete own sync queue" ON sync_queue;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES - Allow public SELECT
-- ============================================================================

CREATE POLICY "Public can view users"
ON users FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- TASKS TABLE POLICIES - Allow public SELECT
-- ============================================================================

CREATE POLICY "Public can view tasks"
ON tasks FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create tasks"
ON tasks FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tasks"
ON tasks FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tasks"
ON tasks FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- REPORTS TABLE POLICIES - Allow public SELECT
-- ============================================================================

CREATE POLICY "Public can view reports"
ON reports FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reports"
ON reports FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update reports"
ON reports FOR UPDATE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- LOCATIONS TABLE POLICIES - Allow public SELECT
-- ============================================================================

CREATE POLICY "Public can view locations"
ON locations FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert locations"
ON locations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update locations"
ON locations FOR UPDATE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- PARTS TABLE POLICIES - Allow public SELECT
-- ============================================================================

CREATE POLICY "Public can view parts"
ON parts FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create parts"
ON parts FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update parts"
ON parts FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete parts"
ON parts FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- SYNC_QUEUE TABLE POLICIES - Keep user-specific
-- ============================================================================

CREATE POLICY "Users can view own sync queue"
ON sync_queue FOR SELECT
USING (user_id = auth.uid() OR auth.role() = 'authenticated');

CREATE POLICY "Users can insert own sync queue"
ON sync_queue FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sync queue"
ON sync_queue FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sync queue"
ON sync_queue FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema to anon and authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant SELECT to anon (for public read access)
GRANT SELECT ON users TO anon;
GRANT SELECT ON tasks TO anon;
GRANT SELECT ON reports TO anon;
GRANT SELECT ON locations TO anon;
GRANT SELECT ON parts TO anon;

-- Grant all permissions to authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_queue TO authenticated;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;