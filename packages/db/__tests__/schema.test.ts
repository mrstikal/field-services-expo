import { describe, expect, it } from 'vitest';
import {
  insertUsersSchema,
  locationsSchema,
  partsSchema,
  reportsSchema,
  tasksSchema,
  usersSchema,
} from '../schema';

describe('database schemas', () => {
  it('validates user records and inserts', () => {
    const now = new Date();
    expect(
      usersSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        role: 'technician',
        name: 'Test User',
        phone: '555-1234',
        avatar_url: null,
        expo_push_token: null,
        is_online: true,
        last_location_lat: 40.7128,
        last_location_lng: -74.006,
        created_at: now,
        updated_at: now,
      }).success
    ).toBe(true);

    expect(
      insertUsersSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174999',
        email: 'dispatcher@example.com',
        role: 'dispatcher',
      }).success
    ).toBe(true);
  });

  it('validates tasks including tombstones', () => {
    const now = new Date();
    expect(
      tasksSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Task',
        description: 'Test Description',
        address: '123 Test St',
        latitude: null,
        longitude: null,
        status: 'assigned',
        priority: 'high',
        category: 'repair',
        due_date: now,
        customer_name: 'John Doe',
        customer_phone: '555-1234',
        estimated_time: 120,
        technician_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      }).success
    ).toBe(true);
  });

  it('validates reports, locations and parts', () => {
    const now = new Date();

    expect(
      reportsSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174002',
        task_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'draft',
        photos: ['photo1.jpg'],
        form_data: { note: 'ok' },
        signature: null,
        pdf_url: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      }).success
    ).toBe(true);

    expect(
      locationsSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174003',
        technician_id: '123e4567-e89b-12d3-a456-426614174004',
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5.5,
        timestamp: now,
        created_at: now,
      }).success
    ).toBe(true);

    expect(
      partsSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174005',
        name: 'Circuit Breaker',
        description: '16A Circuit Breaker',
        barcode: '1234567890123',
        price: '25.99',
        stock: 10,
        category: 'electrical',
        created_at: now,
        updated_at: now,
      }).success
    ).toBe(true);
  });
});
