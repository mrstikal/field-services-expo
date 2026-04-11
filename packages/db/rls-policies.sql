-- Field Service App - Row Level Security Policies
-- Identity model: public.users.id must match auth.users.id.
-- Business role source of truth: public.users.role.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Dispatchers can view all technicians" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Technicians can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Dispatchers can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Dispatchers can create tasks" ON tasks;
DROP POLICY IF EXISTS "Dispatchers can update tasks" ON tasks;
DROP POLICY IF EXISTS "Technicians can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Dispatchers can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Technicians can view own reports" ON reports;
DROP POLICY IF EXISTS "Dispatchers can view all reports" ON reports;
DROP POLICY IF EXISTS "Technicians can create reports" ON reports;
DROP POLICY IF EXISTS "Technicians can update own reports" ON reports;
DROP POLICY IF EXISTS "Dispatchers can update reports" ON reports;
DROP POLICY IF EXISTS "Technicians can view own locations" ON locations;
DROP POLICY IF EXISTS "Dispatchers can view all locations" ON locations;
DROP POLICY IF EXISTS "Technicians can insert own locations" ON locations;
DROP POLICY IF EXISTS "Technicians can update own locations" ON locations;
DROP POLICY IF EXISTS "Everyone can view parts" ON parts;
DROP POLICY IF EXISTS "Dispatchers can create parts" ON parts;
DROP POLICY IF EXISTS "Dispatchers can update parts" ON parts;
DROP POLICY IF EXISTS "Dispatchers can delete parts" ON parts;
DROP POLICY IF EXISTS "Users can view own sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can insert own sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can update own sync queue" ON sync_queue;
DROP POLICY IF EXISTS "Users can delete own sync queue" ON sync_queue;

CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Dispatchers can view technicians"
ON users FOR SELECT
USING (
  public.current_app_role() = 'dispatcher'
  AND role = 'technician'
);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Technicians can view assigned tasks"
ON tasks FOR SELECT
USING (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
);

CREATE POLICY "Dispatchers can view all tasks"
ON tasks FOR SELECT
USING (public.current_app_role() = 'dispatcher');

CREATE POLICY "Dispatchers can create tasks"
ON tasks FOR INSERT
WITH CHECK (public.current_app_role() = 'dispatcher');

CREATE POLICY "Dispatchers can update tasks"
ON tasks FOR UPDATE
USING (public.current_app_role() = 'dispatcher')
WITH CHECK (public.current_app_role() = 'dispatcher');

CREATE POLICY "Technicians can update assigned tasks"
ON tasks FOR UPDATE
USING (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
)
WITH CHECK (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
);

CREATE POLICY "Dispatchers can view all reports"
ON reports FOR SELECT
USING (public.current_app_role() = 'dispatcher');

CREATE POLICY "Technicians can view reports for assigned tasks"
ON reports FOR SELECT
USING (
  public.current_app_role() = 'technician'
  AND EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = reports.task_id
      AND tasks.technician_id = auth.uid()
  )
);

CREATE POLICY "Dispatchers can insert reports"
ON reports FOR INSERT
WITH CHECK (public.current_app_role() = 'dispatcher');

CREATE POLICY "Technicians can insert reports for assigned tasks"
ON reports FOR INSERT
WITH CHECK (
  public.current_app_role() = 'technician'
  AND EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = reports.task_id
      AND tasks.technician_id = auth.uid()
  )
);

CREATE POLICY "Dispatchers can update reports"
ON reports FOR UPDATE
USING (public.current_app_role() = 'dispatcher')
WITH CHECK (public.current_app_role() = 'dispatcher');

CREATE POLICY "Technicians can update reports for assigned tasks"
ON reports FOR UPDATE
USING (
  public.current_app_role() = 'technician'
  AND EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = reports.task_id
      AND tasks.technician_id = auth.uid()
  )
)
WITH CHECK (
  public.current_app_role() = 'technician'
  AND EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = reports.task_id
      AND tasks.technician_id = auth.uid()
  )
);

CREATE POLICY "Dispatchers can view all locations"
ON locations FOR SELECT
USING (public.current_app_role() = 'dispatcher');

CREATE POLICY "Technicians can view own locations"
ON locations FOR SELECT
USING (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
);

CREATE POLICY "Technicians can insert own locations"
ON locations FOR INSERT
WITH CHECK (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
);

CREATE POLICY "Technicians can update own locations"
ON locations FOR UPDATE
USING (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
)
WITH CHECK (
  public.current_app_role() = 'technician'
  AND technician_id = auth.uid()
);

CREATE POLICY "Authenticated users can view parts"
ON parts FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Dispatchers can create parts"
ON parts FOR INSERT
WITH CHECK (public.current_app_role() = 'dispatcher');

CREATE POLICY "Dispatchers can update parts"
ON parts FOR UPDATE
USING (public.current_app_role() = 'dispatcher')
WITH CHECK (public.current_app_role() = 'dispatcher');

CREATE POLICY "Dispatchers can delete parts"
ON parts FOR DELETE
USING (public.current_app_role() = 'dispatcher');

GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON users FROM authenticated;
REVOKE ALL ON tasks FROM authenticated;
REVOKE ALL ON reports FROM authenticated;
REVOKE ALL ON locations FROM authenticated;
REVOKE ALL ON parts FROM authenticated;
REVOKE ALL ON sync_queue FROM authenticated;

GRANT SELECT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parts TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;

CREATE POLICY "Users can view messages in own conversations"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can insert messages in own conversations"
ON messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = conversation_id
      AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update own messages"
ON messages FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
USING (sender_id = auth.uid());

-- Message reads policies
DROP POLICY IF EXISTS "Users can view message reads" ON message_reads;
DROP POLICY IF EXISTS "Users can insert own message reads" ON message_reads;

CREATE POLICY "Users can view message reads"
ON message_reads FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM messages
    JOIN conversations ON conversations.id = messages.conversation_id
    WHERE messages.id = message_reads.message_id
      AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can insert own message reads"
ON message_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Grant permissions for messaging tables
REVOKE ALL ON conversations FROM authenticated;
REVOKE ALL ON messages FROM authenticated;
REVOKE ALL ON message_reads FROM authenticated;

GRANT SELECT, INSERT ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT ON message_reads TO authenticated;
