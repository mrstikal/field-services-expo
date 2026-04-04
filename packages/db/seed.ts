import { db } from './index';
import { users, tasks, reports, parts, locations } from './schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Generate UUIDs for references
const dispatcher1Id = randomUUID();
const dispatcher2Id = randomUUID();
const technik1Id = randomUUID();
const technik2Id = randomUUID();
const technik3Id = randomUUID();
const technik4Id = randomUUID();
const technik5Id = randomUUID();
const task1Id = randomUUID();
const task2Id = randomUUID();
const task3Id = randomUUID();
const task4Id = randomUUID();
const task5Id = randomUUID();
const report1Id = randomUUID();
const report2Id = randomUUID();
const part1Id = randomUUID();
const part2Id = randomUUID();
const part3Id = randomUUID();
const part4Id = randomUUID();
const part5Id = randomUUID();
const location1Id = randomUUID();
const location2Id = randomUUID();

// Demo users
const demoUsers = [
  {
    id: dispatcher1Id,
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
    id: dispatcher2Id,
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
    id: technik1Id,
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
    id: technik2Id,
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
    id: technik3Id,
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
    id: technik4Id,
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
    id: technik5Id,
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

// Demo tasks
const demoTasks = [
  {
    id: task1Id,
    title: 'Switchboard repair',
    description: 'Urgent switchboard malfunction requiring immediate repair',
    address: 'Václavské nám. 1, Praha 1',
    latitude: '50.0755',
    longitude: '14.4378',
    status: 'assigned' as const,
    priority: 'urgent' as const,
    category: 'repair' as const,
    due_date: new Date(Date.now() + 86400000),
    customer_name: 'John Smith',
    customer_phone: '+420 123 456 789',
    estimated_time: 120,
    technician_id: null,
  },
  {
    id: task2Id,
    title: 'Circuit breaker installation',
    description: 'Replacement of old circuit breakers in residential building',
    address: 'Nám. Svobody 5, Brno',
    latitude: '49.1955',
    longitude: '16.6081',
    status: 'assigned' as const,
    priority: 'high' as const,
    category: 'installation' as const,
    due_date: new Date(Date.now() + 172800000),
    customer_name: 'Paul Smith',
    customer_phone: '+420 123 456 790',
    estimated_time: 180,
    technician_id: null,
  },
  {
    id: task3Id,
    title: 'Electrical installation inspection',
    description: 'Regular electrical installation inspection',
    address: 'Milady Horákové 10, Praha 7',
    latitude: '50.0886',
    longitude: '14.4206',
    status: 'assigned' as const,
    priority: 'medium' as const,
    category: 'inspection' as const,
    due_date: new Date(Date.now() + 259200000),
    customer_name: 'Anna Johnson',
    customer_phone: '+420 123 456 791',
    estimated_time: 90,
    technician_id: null,
  },
  {
    id: task4Id,
    title: 'Switchboard maintenance',
    description: 'Switchboard inspection and maintenance',
    address: 'Vinohrady, Praha 2',
    latitude: '50.0833',
    longitude: '14.4458',
    status: 'in_progress' as const,
    priority: 'medium' as const,
    category: 'maintenance' as const,
    due_date: new Date(Date.now() - 86400000),
    customer_name: 'Peter Brown',
    customer_phone: '+420 123 456 792',
    estimated_time: 120,
    technician_id: technik1Id,
  },
  {
    id: task5Id,
    title: 'Cable replacement',
    description: 'Replacement of old cables in switchboard',
    address: 'Králova Pole, Brno',
    latitude: '49.1833',
    longitude: '16.6000',
    status: 'in_progress' as const,
    priority: 'high' as const,
    category: 'repair' as const,
    due_date: new Date(Date.now() - 172800000),
    customer_name: 'Charles Wilson',
    customer_phone: '+420 123 456 793',
    estimated_time: 240,
    technician_id: technik2Id,
  },
];

// Demo reports
const demoReports = [
  {
    id: report1Id,
    task_id: task4Id,
    status: 'completed' as const,
    photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    form_data: { description: 'Repair completed', parts_used: '3x circuit breaker' },
    signature: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
  },
  {
    id: report2Id,
    task_id: task5Id,
    status: 'completed' as const,
    photos: ['https://example.com/photo3.jpg'],
    form_data: { description: 'Replacement completed', parts_used: '5x cable' },
    signature: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgOTBDMTAgOTAgNTAgNjAgMTAwIDQwQzE1MCAyMCAxOTAgMTAgMTkwIDEwQzE5MCAxMCAxOTAgMTAgMTkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
  },
];

// Demo parts
const demoParts = [
  {
    id: part1Id,
    name: 'Circuit breaker 16A',
    description: 'Circuit breaker 16A, 2-pole',
    barcode: '5901234123457',
    price: '150',
    stock: 50,
    category: 'circuit_breakers',
  },
  {
    id: part2Id,
    name: 'Circuit breaker 25A',
    description: 'Circuit breaker 25A, 2-pole',
    barcode: '5901234123458',
    price: '180',
    stock: 30,
    category: 'circuit_breakers',
  },
  {
    id: part3Id,
    name: 'Circuit breaker 32A',
    description: 'Circuit breaker 32A, 2-pole',
    barcode: '5901234123459',
    price: '200',
    stock: 25,
    category: 'circuit_breakers',
  },
  {
    id: part4Id,
    name: 'Cable 2.5mm²',
    description: 'Cable 2.5mm², 100m',
    barcode: '5901234123460',
    price: '500',
    stock: 10,
    category: 'cables',
  },
  {
    id: part5Id,
    name: 'Cable 1.5mm²',
    description: 'Cable 1.5mm², 100m',
    barcode: '5901234123461',
    price: '400',
    stock: 15,
    category: 'cables',
  },
];

// Demo locations
const demoLocations = [
  {
    id: location1Id,
    technician_id: technik1Id,
    latitude: '50.0755',
    longitude: '14.4378',
    accuracy: '10',
    timestamp: new Date(),
  },
  {
    id: location2Id,
    technician_id: technik2Id,
    latitude: '49.1955',
    longitude: '16.6081',
    accuracy: '10',
    timestamp: new Date(),
  },
];

export async function seed() {
  console.log('🌱 Seeding database...');

  // Clear tables
  await db.delete(locations);
  await db.delete(reports);
  await db.delete(tasks);
  await db.delete(parts);
  await db.delete(users);

  // Insert users
  await db.insert(users).values(demoUsers);
  console.log('✓ Users inserted');

  // Insert tasks
  await db.insert(tasks).values(demoTasks);
  console.log('✓ Tasks inserted');

  // Insert reports
  await db.insert(reports).values(demoReports);
  console.log('✓ Reports inserted');

  // Insert parts
  await db.insert(parts).values(demoParts);
  console.log('✓ Parts inserted');

  // Insert locations
  await db.insert(locations).values(demoLocations);
  console.log('✓ Locations inserted');

  console.log('🌱 Seed completed!');
}

// Run seed if executed directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error during seeding:', error);
      process.exit(1);
    });
}