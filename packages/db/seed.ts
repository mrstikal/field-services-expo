import { db } from './index';
import { locations, parts, reports, tasks, users } from './schema';

const USER_IDS = {
  dispatcher1: '550e8400-e29b-41d4-a716-446655440001',
  dispatcher2: '550e8400-e29b-41d4-a716-446655440002',
  technik1: '550e8400-e29b-41d4-a716-446655440003',
  technik2: '550e8400-e29b-41d4-a716-446655440004',
  technik3: '550e8400-e29b-41d4-a716-446655440005',
  technik4: '550e8400-e29b-41d4-a716-446655440006',
  technik5: '550e8400-e29b-41d4-a716-446655440007',
} as const;

const TASK_IDS = {
  task1: '650e8400-e29b-41d4-a716-446655440001',
  task2: '650e8400-e29b-41d4-a716-446655440002',
  task3: '650e8400-e29b-41d4-a716-446655440003',
  task4: '650e8400-e29b-41d4-a716-446655440005',
  task5: '650e8400-e29b-41d4-a716-446655440010',
} as const;

const REPORT_IDS = {
  report1: '750e8400-e29b-41d4-a716-446655440001',
  report2: '750e8400-e29b-41d4-a716-446655440002',
} as const;

const PART_IDS = {
  part1: '850e8400-e29b-41d4-a716-446655440001',
  part2: '850e8400-e29b-41d4-a716-446655440002',
  part3: '850e8400-e29b-41d4-a716-446655440003',
  part4: '850e8400-e29b-41d4-a716-446655440004',
  part5: '850e8400-e29b-41d4-a716-446655440005',
} as const;

const LOCATION_IDS = {
  location1: '950e8400-e29b-41d4-a716-446655440001',
  location2: '950e8400-e29b-41d4-a716-446655440002',
} as const;

const demoUsers = [
  {
    id: USER_IDS.dispatcher1,
    email: 'dispatcher1@demo.cz',
    role: 'dispatcher' as const,
    name: 'John Smith',
    phone: '+420 123 456 789',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
  {
    id: USER_IDS.dispatcher2,
    email: 'dispatcher2@demo.cz',
    role: 'dispatcher' as const,
    name: 'Jane Doe',
    phone: '+420 123 456 790',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
  {
    id: USER_IDS.technik1,
    email: 'technik1@demo.cz',
    role: 'technician' as const,
    name: 'Peter Johnson',
    phone: '+420 777 111 222',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
  {
    id: USER_IDS.technik2,
    email: 'technik2@demo.cz',
    role: 'technician' as const,
    name: 'Anna Williams',
    phone: '+420 777 111 223',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
  {
    id: USER_IDS.technik3,
    email: 'technik3@demo.cz',
    role: 'technician' as const,
    name: 'Thomas Brown',
    phone: '+420 777 111 224',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
  {
    id: USER_IDS.technik4,
    email: 'technik4@demo.cz',
    role: 'technician' as const,
    name: 'Michael Davis',
    phone: '+420 777 111 225',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
  {
    id: USER_IDS.technik5,
    email: 'technik5@demo.cz',
    role: 'technician' as const,
    name: 'David Miller',
    phone: '+420 777 111 226',
    avatar_url: null,
    is_online: false,
    last_location_lat: null,
    last_location_lng: null,
  },
];

const demoTasks = [
  {
    id: TASK_IDS.task5,
    title: 'Switchboard repair',
    description: 'Urgent switchboard malfunction requiring immediate repair',
    address: 'Václavské nám. 1, Praha 1',
    latitude: 50.0755,
    longitude: 14.4378,
    status: 'assigned' as const,
    priority: 'urgent' as const,
    category: 'repair' as const,
    due_date: new Date(Date.now() + 86400000),
    customer_name: 'John Smith',
    customer_phone: '+420 123 456 789',
    estimated_time: 120,
    technician_id: null,
    deleted_at: null,
    version: 1,
  },
  {
    id: TASK_IDS.task2,
    title: 'Circuit breaker installation',
    description: 'Replacement of old circuit breakers in residential building',
    address: 'Nám. Svobody 5, Brno',
    latitude: 49.1955,
    longitude: 16.6081,
    status: 'assigned' as const,
    priority: 'high' as const,
    category: 'installation' as const,
    due_date: new Date(Date.now() + 172800000),
    customer_name: 'Paul Smith',
    customer_phone: '+420 123 456 790',
    estimated_time: 180,
    technician_id: null,
    deleted_at: null,
    version: 1,
  },
  {
    id: TASK_IDS.task3,
    title: 'Electrical installation inspection',
    description: 'Regular electrical installation inspection',
    address: 'Milady Horákové 10, Praha 7',
    latitude: 50.0886,
    longitude: 14.4206,
    status: 'assigned' as const,
    priority: 'medium' as const,
    category: 'inspection' as const,
    due_date: new Date(Date.now() + 259200000),
    customer_name: 'Anna Johnson',
    customer_phone: '+420 123 456 791',
    estimated_time: 90,
    technician_id: null,
    deleted_at: null,
    version: 1,
  },
  {
    id: TASK_IDS.task1,
    title: 'Switchboard maintenance',
    description: 'Switchboard inspection and maintenance',
    address: 'Vinohrady, Praha 2',
    latitude: 50.0833,
    longitude: 14.4458,
    status: 'in_progress' as const,
    priority: 'medium' as const,
    category: 'maintenance' as const,
    due_date: new Date(Date.now() - 86400000),
    customer_name: 'Peter Brown',
    customer_phone: '+420 123 456 792',
    estimated_time: 120,
    technician_id: USER_IDS.technik1,
    deleted_at: null,
    version: 1,
  },
  {
    id: TASK_IDS.task4,
    title: 'Cable replacement',
    description: 'Replacement of old cables in switchboard',
    address: 'Králova Pole, Brno',
    latitude: 49.1833,
    longitude: 16.6,
    status: 'in_progress' as const,
    priority: 'high' as const,
    category: 'repair' as const,
    due_date: new Date(Date.now() - 172800000),
    customer_name: 'Charles Wilson',
    customer_phone: '+420 123 456 793',
    estimated_time: 240,
    technician_id: USER_IDS.technik2,
    deleted_at: null,
    version: 1,
  },
];

const demoReports = [
  {
    id: REPORT_IDS.report1,
    task_id: TASK_IDS.task1,
    status: 'completed' as const,
    photos: [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ],
    form_data: {
      description: 'Repair completed',
      parts_used: '3x circuit breaker',
    },
    signature:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
    deleted_at: null,
    version: 1,
  },
  {
    id: REPORT_IDS.report2,
    task_id: TASK_IDS.task4,
    status: 'completed' as const,
    photos: ['https://example.com/photo3.jpg'],
    form_data: { description: 'Replacement completed', parts_used: '5x cable' },
    signature:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
    deleted_at: null,
    version: 1,
  },
];

const demoParts = [
  {
    id: PART_IDS.part1,
    name: 'Circuit breaker 16A',
    description: 'Circuit breaker 16A, 2-pole',
    barcode: '5901234123457',
    price: '150',
    stock: 50,
    category: 'circuit_breakers',
  },
  {
    id: PART_IDS.part2,
    name: 'Circuit breaker 25A',
    description: 'Circuit breaker 25A, 2-pole',
    barcode: '5901234123458',
    price: '180',
    stock: 30,
    category: 'circuit_breakers',
  },
  {
    id: PART_IDS.part3,
    name: 'Circuit breaker 32A',
    description: 'Circuit breaker 32A, 2-pole',
    barcode: '5901234123459',
    price: '200',
    stock: 25,
    category: 'circuit_breakers',
  },
  {
    id: PART_IDS.part4,
    name: 'Cable 2.5mm2',
    description: 'Cable 2.5mm2, 100m',
    barcode: '5901234123460',
    price: '500',
    stock: 10,
    category: 'cables',
  },
  {
    id: PART_IDS.part5,
    name: 'Cable 1.5mm2',
    description: 'Cable 1.5mm2, 100m',
    barcode: '5901234123461',
    price: '400',
    stock: 15,
    category: 'cables',
  },
];

const demoLocations = [
  {
    id: LOCATION_IDS.location1,
    technician_id: USER_IDS.technik1,
    latitude: 50.0755,
    longitude: 14.4378,
    accuracy: 10,
    timestamp: new Date(),
  },
  {
    id: LOCATION_IDS.location2,
    technician_id: USER_IDS.technik2,
    latitude: 49.1955,
    longitude: 16.6081,
    accuracy: 10,
    timestamp: new Date(),
  },
];

export async function seed() {
  console.log('Seeding database...');

  await db.delete(locations);
  await db.delete(reports);
  await db.delete(tasks);
  await db.delete(parts);
  await db.delete(users);

  await db.insert(users).values(demoUsers);
  console.log('Users inserted');

  await db.insert(tasks).values(demoTasks);
  console.log('Tasks inserted');

  await db.insert(reports).values(demoReports);
  console.log('Reports inserted');

  await db.insert(parts).values(demoParts);
  console.log('Parts inserted');

  await db.insert(locations).values(demoLocations);
  console.log('Locations inserted');

  console.log('Seed completed');
}

if (require.main === module) {
  (async () => {
    try {
      const { connect } = await import('./index');
      await connect();
      await seed();
      console.log('Seed completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during seeding:', error);
      process.exit(1);
    }
  })();
}
