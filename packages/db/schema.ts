import { pgTable, text, timestamp, uuid, boolean, numeric, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['technician', 'dispatcher'] }).notNull(),
  name: text('name'),
  phone: text('phone'),
  avatar_url: text('avatar_url'),
  is_online: boolean('is_online').default(false),
  last_location_lat: numeric('last_location_lat'),
  last_location_lng: numeric('last_location_lng'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const usersSchema = createSelectSchema(users, {
  email: z.string().email(),
  role: z.enum(['technician', 'dispatcher']),
});

export const insertUsersSchema = createInsertSchema(users, {
  email: z.string().email(),
  role: z.enum(['technician', 'dispatcher']).optional(),
});

// Tasks table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  address: text('address').notNull(),
  latitude: numeric('latitude').notNull(),
  longitude: numeric('longitude').notNull(),
  status: text('status', { enum: ['assigned', 'in_progress', 'completed'] }).notNull().default('assigned'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull().default('medium'),
  category: text('category', { enum: ['repair', 'installation', 'maintenance', 'inspection'] }).notNull(),
  due_date: timestamp('due_date').notNull(),
  customer_name: text('customer_name').notNull(),
  customer_phone: text('customer_phone').notNull(),
  estimated_time: integer('estimated_time').notNull(),
  technician_id: uuid('technician_id').references(() => users.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  version: integer('version').notNull().default(1),
});

export const tasksSchema = createSelectSchema(tasks);

// Reports table
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').notNull().references(() => tasks.id),
  status: text('status', { enum: ['draft', 'completed', 'synced'] }).notNull().default('draft'),
  photos: text('photos').array().notNull().default([]),
  form_data: jsonb('form_data').notNull().default({}),
  signature: text('signature'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  version: integer('version').notNull().default(1),
});

export const reportsSchema = createSelectSchema(reports);

// Locations table
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  technician_id: uuid('technician_id').notNull().references(() => users.id),
  latitude: numeric('latitude').notNull(),
  longitude: numeric('longitude').notNull(),
  accuracy: numeric('accuracy').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const locationsSchema = createSelectSchema(locations);

// Parts/Inventory table
export const parts = pgTable('parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  barcode: text('barcode').notNull().unique(),
  price: numeric('price').notNull(),
  stock: integer('stock').notNull().default(0),
  category: text('category').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const partsSchema = createSelectSchema(parts);

// Sync queue table
export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  type: text('type', { enum: ['task', 'report', 'location'] }).notNull(),
  action: text('action', { enum: ['create', 'update', 'delete'] }).notNull(),
  data: jsonb('data').notNull(),
  version: integer('version').notNull().default(1),
  status: text('status', { enum: ['pending', 'synced', 'failed'] }).notNull().default('pending'),
  error: text('error'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const syncQueueSchema = createSelectSchema(syncQueue);