import { describe, expect, it } from 'vitest';
import {
  businessRoleSchema,
  localReportSchema,
  localTaskSchema,
  locationRecordSchema,
  reportRecordSchema,
  syncChangeSchema,
  syncPullRequestSchema,
  syncPushRequestSchema,
  taskCreateInputSchema,
  taskRecordSchema,
  taskUpdateInputSchema,
  type Part,
  type Technician,
  type User,
} from '../index';

describe('shared schemas', () => {
  it('validates task records and create/update payloads', () => {
    const task = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Inspect switchboard',
      description: 'Verify main panel wiring',
      address: 'Main Street 1',
      latitude: 50.1,
      longitude: 14.4,
      status: 'assigned',
      priority: 'high',
      category: 'inspection',
      due_date: '2026-04-08T10:00:00.000Z',
      customer_name: 'Jane Doe',
      customer_phone: '+420123456789',
      estimated_time: 90,
      technician_id: null,
      created_at: '2026-04-08T08:00:00.000Z',
      updated_at: '2026-04-08T08:00:00.000Z',
      version: 1,
      deleted_at: null,
    };

    expect(taskRecordSchema.safeParse(task).success).toBe(true);
    expect(localTaskSchema.safeParse({ ...task, synced: 1 }).success).toBe(
      true
    );
    expect(
      taskCreateInputSchema.safeParse({
        ...task,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
        version: undefined,
        deleted_at: undefined,
      }).success
    ).toBe(true);
    expect(
      taskUpdateInputSchema.safeParse({ title: 'Updated title' }).success
    ).toBe(true);
  });

  it('validates reports, locations and sync envelopes', () => {
    const report = {
      id: '123e4567-e89b-12d3-a456-426614174010',
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'draft',
      photos: ['photo-1'],
      form_data: { field: 'value' },
      signature: null,
      pdf_url: null,
      created_at: '2026-04-08T08:00:00.000Z',
      updated_at: '2026-04-08T08:00:00.000Z',
      version: 1,
      deleted_at: null,
    };
    const location = {
      id: '123e4567-e89b-12d3-a456-426614174020',
      technician_id: '123e4567-e89b-12d3-a456-426614174021',
      latitude: 50.1,
      longitude: 14.4,
      accuracy: 5,
      timestamp: '2026-04-08T08:00:00.000Z',
      created_at: '2026-04-08T08:00:00.000Z',
    };
    const change = {
      id: '123e4567-e89b-12d3-a456-426614174030',
      type: 'task',
      action: 'update',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      data: { title: 'Updated title' },
      version: 2,
    };

    expect(reportRecordSchema.safeParse(report).success).toBe(true);
    expect(localReportSchema.safeParse({ ...report, synced: 0 }).success).toBe(
      true
    );
    expect(locationRecordSchema.safeParse(location).success).toBe(true);
    expect(syncChangeSchema.safeParse(change).success).toBe(true);
    expect(
      syncPullRequestSchema.safeParse({
        lastSyncTimestamp: '2026-04-08T08:00:00.000Z',
      }).success
    ).toBe(true);
    expect(syncPushRequestSchema.safeParse({ changes: [change] }).success).toBe(
      true
    );
  });

  it('exports stable TypeScript contracts', () => {
    const technician: Technician = {
      id: 'tech-1',
      name: 'Tech',
      email: 'tech@example.com',
      phone: '123',
      role: 'technician',
      avatar_url: null,
      is_online: true,
      last_location: null,
      created_at: '2026-04-08T08:00:00.000Z',
    };

    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'dispatcher',
      profile: {
        name: 'Dispatcher',
        phone: '456',
        avatar_url: null,
      },
    };

    const part: Part = {
      id: 'part-1',
      name: 'Breaker',
      description: null,
      barcode: '1234567890123',
      price: 10,
      stock: 5,
      category: 'electrical',
      created_at: '2026-04-08T08:00:00.000Z',
    };

    expect(businessRoleSchema.safeParse(user.role).success).toBe(true);
    expect(technician.email).toContain('@');
    expect(part.stock).toBeGreaterThanOrEqual(0);
  });
});
