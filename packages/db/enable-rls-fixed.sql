-- Re-enable RLS with fixed policies that work with Supabase Auth
-- This version uses proper JWT claims and allows public access for demo

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Allow all authenticated users to view all users (for dispatcher to see technicians)
CREATE POLICY "Authenticated users can view all users"
ON users FOR SELECT
USING (auth.role() = 'authenticated');

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- TASKS TABLE POLICIES
-- ============================================================================

-- Technicians can view only their assigned tasks
CREATE POLICY "Technicians can view own tasks"
ON tasks FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'technician'
  AND technician_id = auth.uid()
);

-- Dispatchers can view all tasks
CREATE POLICY "Dispatchers can view all tasks"
ON tasks FOR SELECT
USING (auth.jwt() ->> 'role' = 'dispatcher');

-- Dispatchers can create tasks
CREATE POLICY "Dispatchers can create tasks"
ON tasks FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'dispatcher');

-- Dispatchers can update tasks
CREATE POLICY "Dispatchers can update tasks"
ON tasks FOR UPDATE
USING (auth.jwt() ->> 'role' = 'dispatcher');

-- Technicians can update their own tasks (status, updated_at)
CREATE POLICY "Technicians can update own tasks"
ON tasks FOR UPDATE
USING (
  auth.jwt() ->> 'role' = 'technician'
  AND technician_id = auth.uid()
);

-- Dispatchers can delete tasks
CREATE POLICY "Dispatchers can delete tasks"
ON tasks FOR DELETE
USING (auth.jwt() ->> 'role' = 'dispatcher');

-- ============================================================================
-- REPORTS TABLE POLICIES
-- ============================================================================

-- Allow all authenticated users to view all reports
CREATE POLICY "Authenticated users can view all reports"
ON reports FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to create reports
CREATE POLICY "Authenticated users can create reports"
ON reports FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update reports
CREATE POLICY "Authenticated users can update reports"
ON reports FOR UPDATE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- LOCATIONS TABLE POLICIES
-- ============================================================================

-- Allow all authenticated users to view all locations
CREATE POLICY "Authenticated users can view all locations"
ON locations FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert locations
CREATE POLICY "Authenticated users can insert locations"
ON locations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update locations
CREATE POLICY "Authenticated users can update locations"
ON locations FOR UPDATE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- PARTS TABLE POLICIES
-- ============================================================================

-- Everyone can view parts (inventory is public)
CREATE POLICY "Everyone can view parts"
ON parts FOR SELECT
USING (true);

-- Only authenticated users can manage parts
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
-- SYNC_QUEUE TABLE POLICIES
-- ============================================================================

-- Users can view their own sync queue items
CREATE POLICY "Users can view own sync queue"
ON sync_queue FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own sync queue items
CREATE POLICY "Users can insert own sync queue"
ON sync_queue FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own sync queue items
CREATE POLICY "Users can update own sync queue"
ON sync_queue FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own sync queue items
CREATE POLICY "Users can delete own sync queue"
ON sync_queue FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_queue TO authenticated;

-- Grant permissions on sequences (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;