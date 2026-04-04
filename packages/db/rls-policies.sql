-- Field Service App - Row Level Security (RLS) Policies
-- These policies ensure that users can only access data they're authorized to see

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

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Dispatchers can view all technicians
CREATE POLICY "Dispatchers can view all technicians"
ON users FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'dispatcher'
  AND role = 'technician'
);

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

-- Technicians can view reports for their tasks
CREATE POLICY "Technicians can view own reports"
ON reports FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'technician'
  AND task_id IN (
    SELECT id FROM tasks WHERE technician_id = auth.uid()
  )
);

-- Dispatchers can view all reports
CREATE POLICY "Dispatchers can view all reports"
ON reports FOR SELECT
USING (auth.jwt() ->> 'role' = 'dispatcher');

-- Technicians can create reports for their tasks
CREATE POLICY "Technicians can create reports"
ON reports FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'role' = 'technician'
  AND task_id IN (
    SELECT id FROM tasks WHERE technician_id = auth.uid()
  )
);

-- Technicians can update their own reports
CREATE POLICY "Technicians can update own reports"
ON reports FOR UPDATE
USING (
  auth.jwt() ->> 'role' = 'technician'
  AND task_id IN (
    SELECT id FROM tasks WHERE technician_id = auth.uid()
  )
);

-- Dispatchers can update reports (for approval, etc.)
CREATE POLICY "Dispatchers can update reports"
ON reports FOR UPDATE
USING (auth.jwt() ->> 'role' = 'dispatcher');

-- ============================================================================
-- LOCATIONS TABLE POLICIES
-- ============================================================================

-- Technicians can view their own locations
CREATE POLICY "Technicians can view own locations"
ON locations FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'technician'
  AND technician_id = auth.uid()
);

-- Dispatchers can view all technician locations
CREATE POLICY "Dispatchers can view all locations"
ON locations FOR SELECT
USING (auth.jwt() ->> 'role' = 'dispatcher');

-- Technicians can insert their own locations
CREATE POLICY "Technicians can insert own locations"
ON locations FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'role' = 'technician'
  AND technician_id = auth.uid()
);

-- Technicians can update their own locations
CREATE POLICY "Technicians can update own locations"
ON locations FOR UPDATE
USING (
  auth.jwt() ->> 'role' = 'technician'
  AND technician_id = auth.uid()
);

-- ============================================================================
-- PARTS TABLE POLICIES
-- ============================================================================

-- Everyone can view parts (inventory is public)
CREATE POLICY "Everyone can view parts"
ON parts FOR SELECT
USING (true);

-- Only dispatchers can manage parts
CREATE POLICY "Dispatchers can create parts"
ON parts FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'dispatcher');

CREATE POLICY "Dispatchers can update parts"
ON parts FOR UPDATE
USING (auth.jwt() ->> 'role' = 'dispatcher');

CREATE POLICY "Dispatchers can delete parts"
ON parts FOR DELETE
USING (auth.jwt() ->> 'role' = 'dispatcher');

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
