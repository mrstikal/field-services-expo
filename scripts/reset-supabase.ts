#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), 'env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DEMO_PASSWORD = 'demo123';

type DemoAuthUser = {
  email: string;
  role: 'technician' | 'dispatcher';
  name: string;
};

const demoAuthUsers: DemoAuthUser[] = [
  { email: 'dispatcher1@demo.cz', role: 'dispatcher', name: 'John Smith' },
  { email: 'dispatcher2@demo.cz', role: 'dispatcher', name: 'Jane Doe' },
  { email: 'technik1@demo.cz', role: 'technician', name: 'Peter Johnson' },
  { email: 'technik2@demo.cz', role: 'technician', name: 'Anna Williams' },
  { email: 'technik3@demo.cz', role: 'technician', name: 'Thomas Brown' },
  { email: 'technik4@demo.cz', role: 'technician', name: 'Michael Davis' },
  { email: 'technik5@demo.cz', role: 'technician', name: 'David Miller' },
];

async function ensureAuthUsers() {
  console.log('🔐 Ensuring Supabase Auth demo users...');

  const { data: authData, error: authListError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authListError) throw authListError;

  const existingByEmail = new Map(
    (authData?.users ?? [])
      .filter((u) => !!u.email)
      .map((u) => [u.email!.toLowerCase(), u])
  );

  for (const demoUser of demoAuthUsers) {
    const existingUser = existingByEmail.get(demoUser.email.toLowerCase());

    if (existingUser) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        email: demoUser.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: demoUser.role,
          name: demoUser.name,
        },
      });

      if (updateError) throw updateError;
      continue;
    }

    const { error: createError } = await supabase.auth.admin.createUser({
      email: demoUser.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: demoUser.role,
        name: demoUser.name,
      },
    });

    if (createError) throw createError;
  }

  console.log('✓ Auth users ready (password: demo123)\n');
}

async function ensureSchema() {
  console.log('🏗️  Ensuring database schema...');

  // Add pdf_url column to reports if it doesn't exist
  // We check by trying to select it first
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?select=pdf_url&limit=1`,
    {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!checkResponse.ok) {
    // Column doesn't exist, we need to add it
    // Use Supabase's pg endpoint (available in newer Supabase versions)
    const sqlResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_url TEXT;'
      }),
    });

    if (sqlResponse.ok) {
      console.log('✓ pdf_url column added to reports table\n');
    } else {
      console.warn('⚠️  Could not add pdf_url column automatically.');
      console.warn('   Please run this SQL in Supabase Dashboard SQL Editor:');
      console.warn('   ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_url TEXT;\n');
    }
  } else {
    console.log('✓ Schema is up to date\n');
  }
}

async function resetDatabase() {
  try {
    console.log('🔄 Resetting Supabase database...\n');

    await ensureSchema();
    await ensureAuthUsers();

    // Get actual user IDs from auth.users
    console.log('🔍 Fetching actual user IDs from auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw authError;

    const userIdMap = new Map<string, string>();
    for (const authUser of authData?.users ?? []) {
      if (authUser.email) {
        userIdMap.set(authUser.email.toLowerCase(), authUser.id);
      }
    }
    console.log('✓ User IDs fetched\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await supabase.from('locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sync_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('parts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✓ Data cleared\n');

    // Insert demo users with correct IDs from auth
    console.log('👥 Inserting demo users...');
    const usersToInsert = [
      {
        id: userIdMap.get('dispatcher1@demo.cz') || '550e8400-e29b-41d4-a716-446655440001',
        email: 'dispatcher1@demo.cz',
        role: 'dispatcher',
        name: 'John Smith',
        phone: '+420 123 456 789',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
      {
        id: userIdMap.get('dispatcher2@demo.cz') || '550e8400-e29b-41d4-a716-446655440002',
        email: 'dispatcher2@demo.cz',
        role: 'dispatcher',
        name: 'Jane Doe',
        phone: '+420 123 456 790',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
      {
        id: userIdMap.get('technik1@demo.cz') || '550e8400-e29b-41d4-a716-446655440003',
        email: 'technik1@demo.cz',
        role: 'technician',
        name: 'Peter Johnson',
        phone: '+420 777 111 222',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
      {
        id: userIdMap.get('technik2@demo.cz') || '550e8400-e29b-41d4-a716-446655440004',
        email: 'technik2@demo.cz',
        role: 'technician',
        name: 'Anna Williams',
        phone: '+420 777 111 223',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
      {
        id: userIdMap.get('technik3@demo.cz') || '550e8400-e29b-41d4-a716-446655440005',
        email: 'technik3@demo.cz',
        role: 'technician',
        name: 'Thomas Brown',
        phone: '+420 777 111 224',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
      {
        id: userIdMap.get('technik4@demo.cz') || '550e8400-e29b-41d4-a716-446655440006',
        email: 'technik4@demo.cz',
        role: 'technician',
        name: 'Michael Davis',
        phone: '+420 777 111 225',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
      {
        id: userIdMap.get('technik5@demo.cz') || '550e8400-e29b-41d4-a716-446655440007',
        email: 'technik5@demo.cz',
        role: 'technician',
        name: 'David Miller',
        phone: '+420 777 111 226',
        avatar_url: null,
        is_online: false,
        last_location_lat: null,
        last_location_lng: null,
      },
    ];

    const { error: usersError } = await supabase.from('users').insert(usersToInsert);
    if (usersError) throw usersError;
    console.log('✓ Users inserted\n');

    // Get technician IDs for task assignment
    const technik1Id = userIdMap.get('technik1@demo.cz');
    const technik2Id = userIdMap.get('technik2@demo.cz');

    // Insert demo tasks (10 tasks: 3 for technik1, 3 for technik2, 4 unassigned)
    console.log('📋 Inserting demo tasks...');
    const tasksToInsert = [
      // Tasks for technik1 (3 tasks)
      {
        id: '650e8400-e29b-41d4-a716-446655440001',
        title: 'Switchboard maintenance',
        description: 'Switchboard inspection and maintenance at office building',
        address: 'Vinohrady, Praha 2',
        latitude: 50.0833,
        longitude: 14.4458,
        status: 'in_progress',
        priority: 'medium',
        category: 'maintenance',
        due_date: new Date(Date.now() - 86400000).toISOString(),
        customer_name: 'Peter Brown',
        customer_phone: '+420 123 456 792',
        estimated_time: 120,
        technician_id: technik1Id,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440006',
        title: 'Electrical wiring repair',
        description: 'Repair of damaged electrical wiring in apartment complex',
        address: 'Žižkov, Praha 3',
        latitude: 50.0819,
        longitude: 14.4569,
        status: 'assigned',
        priority: 'high',
        category: 'repair',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        customer_name: 'Maria Novotná',
        customer_phone: '+420 777 222 333',
        estimated_time: 180,
        technician_id: technik1Id,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440007',
        title: 'Power outlet installation',
        description: 'Installation of new power outlets in kitchen renovation',
        address: 'Nusle, Praha 4',
        latitude: 50.0611,
        longitude: 14.4519,
        status: 'assigned',
        priority: 'medium',
        category: 'installation',
        due_date: new Date(Date.now() + 172800000).toISOString(),
        customer_name: 'Josef Kučera',
        customer_phone: '+420 777 333 444',
        estimated_time: 90,
        technician_id: technik1Id,
        version: 1,
      },
      // Tasks for technik2 (3 tasks)
      {
        id: '650e8400-e29b-41d4-a716-446655440005',
        title: 'Cable replacement',
        description: 'Replacement of old cables in switchboard at factory',
        address: 'Králova Pole, Brno',
        latitude: 49.1833,
        longitude: 16.6000,
        status: 'in_progress',
        priority: 'high',
        category: 'repair',
        due_date: new Date(Date.now() - 172800000).toISOString(),
        customer_name: 'Charles Wilson',
        customer_phone: '+420 123 456 793',
        estimated_time: 240,
        technician_id: technik2Id,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440008',
        title: 'Circuit breaker replacement',
        description: 'Replacement of faulty circuit breakers in distribution panel',
        address: 'Černý Most, Praha 14',
        latitude: 50.1019,
        longitude: 14.5569,
        status: 'assigned',
        priority: 'urgent',
        category: 'repair',
        due_date: new Date(Date.now() + 43200000).toISOString(),
        customer_name: 'Tomáš Svoboda',
        customer_phone: '+420 777 444 555',
        estimated_time: 150,
        technician_id: technik2Id,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440009',
        title: 'Electrical safety inspection',
        description: 'Annual electrical safety inspection for commercial building',
        address: 'Smíchov, Praha 5',
        latitude: 50.0686,
        longitude: 14.4069,
        status: 'assigned',
        priority: 'medium',
        category: 'inspection',
        due_date: new Date(Date.now() + 259200000).toISOString(),
        customer_name: 'Eva Horváthová',
        customer_phone: '+420 777 555 666',
        estimated_time: 120,
        technician_id: technik2Id,
        version: 1,
      },
      // Unassigned tasks (4 tasks)
      {
        id: '650e8400-e29b-41d4-a716-446655440002',
        title: 'Circuit breaker installation',
        description: 'Replacement of old circuit breakers in residential building',
        address: 'Nám. Svobody 5, Brno',
        latitude: 49.1955,
        longitude: 16.6081,
        status: 'assigned',
        priority: 'high',
        category: 'installation',
        due_date: new Date(Date.now() + 172800000).toISOString(),
        customer_name: 'Paul Smith',
        customer_phone: '+420 123 456 790',
        estimated_time: 180,
        technician_id: null,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440003',
        title: 'Electrical installation inspection',
        description: 'Regular electrical installation inspection for new office',
        address: 'Milady Horákové 10, Praha 7',
        latitude: 50.0886,
        longitude: 14.4206,
        status: 'assigned',
        priority: 'medium',
        category: 'inspection',
        due_date: new Date(Date.now() + 259200000).toISOString(),
        customer_name: 'Anna Johnson',
        customer_phone: '+420 123 456 791',
        estimated_time: 90,
        technician_id: null,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440010',
        title: 'Switchboard repair',
        description: 'Urgent switchboard malfunction requiring immediate repair',
        address: 'Václavské nám. 1, Praha 1',
        latitude: 50.0755,
        longitude: 14.4378,
        status: 'assigned',
        priority: 'urgent',
        category: 'repair',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        customer_name: 'John Smith',
        customer_phone: '+420 123 456 789',
        estimated_time: 120,
        technician_id: null,
        version: 1,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440011',
        title: 'Emergency lighting installation',
        description: 'Installation of emergency lighting system in shopping mall',
        address: 'Andělská, Praha 6',
        latitude: 50.0919,
        longitude: 14.3819,
        status: 'assigned',
        priority: 'high',
        category: 'installation',
        due_date: new Date(Date.now() + 345600000).toISOString(),
        customer_name: 'Robert Novák',
        customer_phone: '+420 777 666 777',
        estimated_time: 240,
        technician_id: null,
        version: 1,
      },
    ];

    const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert);
    if (tasksError) throw tasksError;
    console.log('✓ Tasks inserted\n');

    // Insert demo reports
    console.log('📄 Inserting demo reports...');
    const { error: reportsError } = await supabase.from('reports').insert([
      {
        id: '750e8400-e29b-41d4-a716-446655440001',
        task_id: '650e8400-e29b-41d4-a716-446655440001',
        status: 'completed',
        photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        form_data: { description: 'Repair completed', parts_used: '3x circuit breaker' },
        signature: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
        version: 1,
      },
      {
        id: '750e8400-e29b-41d4-a716-446655440002',
        task_id: '650e8400-e29b-41d4-a716-446655440005',
        status: 'completed',
        photos: ['https://example.com/photo3.jpg'],
        form_data: { description: 'Replacement completed', parts_used: '5x cable' },
        signature: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
        version: 1,
      },
    ]);
    if (reportsError) throw reportsError;
    console.log('✓ Reports inserted\n');

    // Insert demo parts
    console.log('🔧 Inserting demo parts...');
    const { error: partsError } = await supabase.from('parts').insert([
      {
        id: '850e8400-e29b-41d4-a716-446655440001',
        name: 'Circuit breaker 16A',
        description: 'Circuit breaker 16A, 2-pole',
        barcode: '5901234123457',
        price: '150',
        stock: 50,
        category: 'circuit_breakers',
      },
      {
        id: '850e8400-e29b-41d4-a716-446655440002',
        name: 'Circuit breaker 25A',
        description: 'Circuit breaker 25A, 2-pole',
        barcode: '5901234123458',
        price: '180',
        stock: 30,
        category: 'circuit_breakers',
      },
      {
        id: '850e8400-e29b-41d4-a716-446655440003',
        name: 'Circuit breaker 32A',
        description: 'Circuit breaker 32A, 2-pole',
        barcode: '5901234123459',
        price: '200',
        stock: 25,
        category: 'circuit_breakers',
      },
      {
        id: '850e8400-e29b-41d4-a716-446655440004',
        name: 'Cable 2.5mm²',
        description: 'Cable 2.5mm², 100m',
        barcode: '5901234123460',
        price: '500',
        stock: 10,
        category: 'cables',
      },
      {
        id: '850e8400-e29b-41d4-a716-446655440005',
        name: 'Cable 1.5mm²',
        description: 'Cable 1.5mm², 100m',
        barcode: '5901234123461',
        price: '400',
        stock: 15,
        category: 'cables',
      },
    ]);
    if (partsError) throw partsError;
    console.log('✓ Parts inserted\n');

    // Insert demo locations
    console.log('📍 Inserting demo locations...');
    const locationsToInsert = [
      {
        id: '950e8400-e29b-41d4-a716-446655440001',
        technician_id: technik1Id,
        latitude: 50.0755,
        longitude: 14.4378,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      },
      {
        id: '950e8400-e29b-41d4-a716-446655440002',
        technician_id: technik2Id,
        latitude: 49.1955,
        longitude: 16.6081,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      },
    ];

    const { error: locationsError } = await supabase.from('locations').insert(locationsToInsert);
    if (locationsError) throw locationsError;
    console.log('✓ Locations inserted\n');

    console.log('✅ Database reset completed successfully!');
    console.log('📊 Demo data is now ready for testing.\n');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();