-- Seed data for Field Service database
-- Clear existing data first
DELETE FROM message_reads;
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM locations;
DELETE FROM sync_queue;
DELETE FROM reports;
DELETE FROM tasks;
DELETE FROM parts;
DELETE FROM users;

-- Insert demo users
INSERT INTO users (id, email, role, name, phone, avatar_url, is_online, last_location_lat, last_location_lng, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001'::uuid, 'dispatcher1@demo.cz', 'dispatcher', 'John Smith', '+420 123 456 789', NULL, false, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002'::uuid, 'dispatcher2@demo.cz', 'dispatcher', 'Jane Doe', '+420 123 456 790', NULL, false, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003'::uuid, 'technik1@demo.cz', 'technician', 'Peter Johnson', '+420 777 111 222', NULL, false, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004'::uuid, 'technik2@demo.cz', 'technician', 'Anna Williams', '+420 777 111 223', NULL, false, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440005'::uuid, 'technik3@demo.cz', 'technician', 'Thomas Brown', '+420 777 111 224', NULL, false, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440006'::uuid, 'technik4@demo.cz', 'technician', 'Michael Davis', '+420 777 111 225', NULL, false, NULL, NULL, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440007'::uuid, 'technik5@demo.cz', 'technician', 'David Miller', '+420 777 111 226', NULL, false, NULL, NULL, NOW(), NOW());

-- Insert demo tasks
INSERT INTO tasks (id, title, description, address, latitude, longitude, status, priority, category, due_date, customer_name, customer_phone, estimated_time, technician_id, created_at, updated_at, version) VALUES
('650e8400-e29b-41d4-a716-446655440001'::uuid, 'Switchboard repair', 'Urgent switchboard malfunction requiring immediate repair', 'Václavské nám. 1, Praha 1', 50.0755, 14.4378, 'assigned', 'urgent', 'repair', NOW() + INTERVAL '1 day', 'John Smith', '+420 123 456 789', 120, NULL, NOW(), NOW(), 1),
('650e8400-e29b-41d4-a716-446655440002'::uuid, 'Circuit breaker installation', 'Replacement of old circuit breakers in residential building', 'Nám. Svobody 5, Brno', 49.1955, 16.6081, 'assigned', 'high', 'installation', NOW() + INTERVAL '2 days', 'Paul Smith', '+420 123 456 790', 180, NULL, NOW(), NOW(), 1),
('650e8400-e29b-41d4-a716-446655440003'::uuid, 'Electrical installation inspection', 'Regular electrical installation inspection', 'Milady Horákové 10, Praha 7', 50.0886, 14.4206, 'assigned', 'medium', 'inspection', NOW() + INTERVAL '3 days', 'Anna Johnson', '+420 123 456 791', 90, NULL, NOW(), NOW(), 1),
('650e8400-e29b-41d4-a716-446655440004'::uuid, 'Switchboard maintenance', 'Switchboard inspection and maintenance', 'Vinohrady, Praha 2', 50.0833, 14.4458, 'in_progress', 'medium', 'maintenance', NOW() - INTERVAL '1 day', 'Peter Brown', '+420 123 456 792', 120, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW(), NOW(), 1),
('650e8400-e29b-41d4-a716-446655440005'::uuid, 'Cable replacement', 'Replacement of old cables in switchboard', 'Králova Pole, Brno', 49.1833, 16.6000, 'in_progress', 'high', 'repair', NOW() - INTERVAL '2 days', 'Charles Wilson', '+420 123 456 793', 240, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW(), NOW(), 1);

-- Insert demo reports
INSERT INTO reports (id, task_id, status, photos, form_data, signature, created_at, updated_at, version) VALUES
('750e8400-e29b-41d4-a716-446655440001'::uuid, '650e8400-e29b-41d4-a716-446655440004'::uuid, 'completed', ARRAY['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'], '{"description": "Repair completed", "parts_used": "3x circuit breaker"}'::jsonb, 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=', NOW(), NOW(), 1),
('750e8400-e29b-41d4-a716-446655440002'::uuid, '650e8400-e29b-41d4-a716-446655440005'::uuid, 'completed', ARRAY['https://example.com/photo3.jpg'], '{"description": "Replacement completed", "parts_used": "5x cable"}'::jsonb, 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=', NOW(), NOW(), 1);

-- Insert demo parts
INSERT INTO parts (id, name, description, barcode, price, stock, category, created_at, updated_at) VALUES
('850e8400-e29b-41d4-a716-446655440001'::uuid, 'Circuit breaker 16A', 'Circuit breaker 16A, 2-pole', '5901234123457', '150'::numeric, 50, 'circuit_breakers', NOW(), NOW()),
('850e8400-e29b-41d4-a716-446655440002'::uuid, 'Circuit breaker 25A', 'Circuit breaker 25A, 2-pole', '5901234123458', '180'::numeric, 30, 'circuit_breakers', NOW(), NOW()),
('850e8400-e29b-41d4-a716-446655440003'::uuid, 'Circuit breaker 32A', 'Circuit breaker 32A, 2-pole', '5901234123459', '200'::numeric, 25, 'circuit_breakers', NOW(), NOW()),
('850e8400-e29b-41d4-a716-446655440004'::uuid, 'Cable 2.5mm²', 'Cable 2.5mm², 100m', '5901234123460', '500'::numeric, 10, 'cables', NOW(), NOW()),
('850e8400-e29b-41d4-a716-446655440005'::uuid, 'Cable 1.5mm²', 'Cable 1.5mm², 100m', '5901234123461', '400'::numeric, 15, 'cables', NOW(), NOW());

-- Insert demo locations
INSERT INTO locations (id, technician_id, latitude, longitude, accuracy, timestamp, created_at) VALUES
('950e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 50.0755, 14.4378, 10, NOW(), NOW()),
('950e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 49.1955, 16.6081, 10, NOW(), NOW());

-- Insert demo conversations
INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at) VALUES
('a50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour'),
('a50e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes'),
('a50e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '10 minutes');

-- Insert demo messages
INSERT INTO messages (id, conversation_id, sender_id, content, sent_at) VALUES
-- Conversation 1: Dispatcher1 <-> Technician1
('b50e8400-e29b-41d4-a716-446655440001'::uuid, 'a50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'Hi Peter, I have assigned you a new urgent task for switchboard repair. Can you handle it today?', NOW() - INTERVAL '2 days'),
('b50e8400-e29b-41d4-a716-446655440002'::uuid, 'a50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Yes, I can take care of it. What time should I be there?', NOW() - INTERVAL '2 days' + INTERVAL '15 minutes'),
('b50e8400-e29b-41d4-a716-446655440003'::uuid, 'a50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'The customer is available from 2 PM. Please confirm when you arrive.', NOW() - INTERVAL '2 days' + INTERVAL '20 minutes'),
('b50e8400-e29b-41d4-a716-446655440004'::uuid, 'a50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Perfect, I will be there at 2 PM. Thanks!', NOW() - INTERVAL '2 days' + INTERVAL '25 minutes'),
('b50e8400-e29b-41d4-a716-446655440005'::uuid, 'a50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Task completed successfully. Report submitted.', NOW() - INTERVAL '1 hour'),

-- Conversation 2: Dispatcher2 <-> Technician2
('b50e8400-e29b-41d4-a716-446655440006'::uuid, 'a50e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'Anna, please check the circuit breaker installation task in Brno.', NOW() - INTERVAL '1 day'),
('b50e8400-e29b-41d4-a716-446655440007'::uuid, 'a50e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'I saw it. Do I need any special equipment?', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
('b50e8400-e29b-41d4-a716-446655440008'::uuid, 'a50e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'Standard tools should be enough. The parts are already at the location.', NOW() - INTERVAL '1 day' + INTERVAL '15 minutes'),
('b50e8400-e29b-41d4-a716-446655440009'::uuid, 'a50e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'Great, I will head there tomorrow morning.', NOW() - INTERVAL '30 minutes'),

-- Conversation 3: Technician1 <-> Technician2
('b50e8400-e29b-41d4-a716-446655440010'::uuid, 'a50e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Hey Anna, do you have a spare multimeter? Mine just broke.', NOW() - INTERVAL '3 hours'),
('b50e8400-e29b-41d4-a716-446655440011'::uuid, 'a50e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'Yes, I have one. When do you need it?', NOW() - INTERVAL '2 hours' + INTERVAL '30 minutes'),
('b50e8400-e29b-41d4-a716-446655440012'::uuid, 'a50e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Tomorrow would be perfect. Can we meet at the office?', NOW() - INTERVAL '10 minutes');

-- Insert demo message reads (marking some messages as read)
INSERT INTO message_reads (id, message_id, user_id, read_at) VALUES
-- Conversation 1 - all messages read by both users except the last one
('c50e8400-e29b-41d4-a716-446655440001'::uuid, 'b50e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
('c50e8400-e29b-41d4-a716-446655440002'::uuid, 'b50e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, NOW() - INTERVAL '2 days' + INTERVAL '16 minutes'),
('c50e8400-e29b-41d4-a716-446655440003'::uuid, 'b50e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW() - INTERVAL '2 days' + INTERVAL '21 minutes'),
('c50e8400-e29b-41d4-a716-446655440004'::uuid, 'b50e8400-e29b-41d4-a716-446655440004'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, NOW() - INTERVAL '2 days' + INTERVAL '26 minutes'),
-- Last message in conversation 1 is unread by dispatcher

-- Conversation 2 - all messages read except the last one
('c50e8400-e29b-41d4-a716-446655440005'::uuid, 'b50e8400-e29b-41d4-a716-446655440006'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '1 day' + INTERVAL '5 minutes'),
('c50e8400-e29b-41d4-a716-446655440006'::uuid, 'b50e8400-e29b-41d4-a716-446655440007'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, NOW() - INTERVAL '1 day' + INTERVAL '11 minutes'),
('c50e8400-e29b-41d4-a716-446655440007'::uuid, 'b50e8400-e29b-41d4-a716-446655440008'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '1 day' + INTERVAL '16 minutes'),
-- Last message in conversation 2 is unread by dispatcher

-- Conversation 3 - all messages read except the last one
('c50e8400-e29b-41d4-a716-446655440008'::uuid, 'b50e8400-e29b-41d4-a716-446655440010'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '3 hours' + INTERVAL '5 minutes'),
('c50e8400-e29b-41d4-a716-446655440009'::uuid, 'b50e8400-e29b-41d4-a716-446655440011'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW() - INTERVAL '2 hours' + INTERVAL '31 minutes');
-- Last message in conversation 3 is unread by Anna

-- Verify data was inserted
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Reports', COUNT(*) FROM reports
UNION ALL
SELECT 'Parts', COUNT(*) FROM parts
UNION ALL
SELECT 'Locations', COUNT(*) FROM locations
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM messages
UNION ALL
SELECT 'Message Reads', COUNT(*) FROM message_reads;
