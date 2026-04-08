import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  numeric,
  integer,
  jsonb,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

const businessRoleSchema = z.enum(['technician', 'dispatcher']);
const taskStatusSchema = z.enum(['assigned', 'in_progress', 'completed']);
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const taskCategorySchema = z.enum([
  'repair',
  'installation',
  'maintenance',
  'inspection',
]);
const reportStatusSchema = z.enum(['draft', 'completed', 'synced']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['technician', 'dispatcher'] }).notNull(),
  name: text('name'),
  phone: text('phone'),
  avatar_url: text('avatar_url'),
  is_online: boolean('is_online').default(false),
  last_location_lat: doublePrecision('last_location_lat'),
  last_location_lng: doublePrecision('last_location_lng'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const usersSchema = createSelectSchema(users, {
  email: z.string().email(),
  role: businessRoleSchema,
});

export const insertUsersSchema = createInsertSchema(users, {
  email: z.string().email(),
  role: businessRoleSchema.optional(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  address: text('address').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  status: text('status', { enum: ['assigned', 'in_progress', 'completed'] })
    .notNull()
    .default('assigned'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
    .notNull()
    .default('medium'),
  category: text('category', {
    enum: ['repair', 'installation', 'maintenance', 'inspection'],
  }).notNull(),
  due_date: timestamp('due_date').notNull(),
  customer_name: text('customer_name').notNull(),
  customer_phone: text('customer_phone').notNull(),
  estimated_time: integer('estimated_time').notNull(),
  technician_id: uuid('technician_id').references(() => users.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
  version: integer('version').notNull().default(1),
});

export const tasksSchema = createSelectSchema(tasks, {
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  category: taskCategorySchema,
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id')
    .notNull()
    .references(() => tasks.id),
  status: text('status', { enum: ['draft', 'completed', 'synced'] })
    .notNull()
    .default('draft'),
  photos: text('photos').array().notNull().default([]),
  form_data: jsonb('form_data').notNull().default({}),
  signature: text('signature'),
  pdf_url: text('pdf_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
  version: integer('version').notNull().default(1),
});

export const reportsSchema = createSelectSchema(reports, {
  status: reportStatusSchema,
});

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  technician_id: uuid('technician_id')
    .notNull()
    .references(() => users.id),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  accuracy: doublePrecision('accuracy').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const locationsSchema = createSelectSchema(locations);

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
