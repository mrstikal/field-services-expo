-- Seed data for Field Service database
-- Clear existing data first
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

-- Verify data was inserted
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Reports', COUNT(*) FROM reports
UNION ALL
SELECT 'Parts', COUNT(*) FROM parts
UNION ALL
SELECT 'Locations', COUNT(*) FROM locations;