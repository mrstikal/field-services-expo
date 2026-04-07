import { describe, it, expect } from 'vitest';

import {
  usersSchema,
  insertUsersSchema,
  tasksSchema,
  reportsSchema,
  locationsSchema,
  partsSchema,
  syncQueueSchema,
} from '../schema';

describe('users schema', () => {
  it('should validate select schema', () => {
    const now = new Date();
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      role: 'technician',
      name: 'Test User',
      phone: '555-1234',
      avatar_url: null,
      is_online: true,
      last_location_lat: 40.7128,
      last_location_lng: -74.0060,
      created_at: now,
      updated_at: now,
    };

    const result = usersSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email in select schema', () => {
    const now = new Date();
    const invalidData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'invalid-email',
      role: 'technician',
      name: 'Test User',
      created_at: now,
      updated_at: now,
    };

    const result = usersSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should validate insert schema with optional role', () => {
    const validData = {
      email: 'test@example.com',
      name: 'Test User',
      phone: '555-1234',
    };

    const result = insertUsersSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate insert schema with role', () => {
    const validData = {
      email: 'test@example.com',
      role: 'dispatcher',
    };

    const result = insertUsersSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('tasks schema', () => {
  it('should validate select schema', () => {
    const now = new Date();
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Task',
      description: 'Test Description',
      address: '123 Test St',
      latitude: 40.7128,
      longitude: -74.0060,
      status: 'assigned',
      priority: 'high',
      category: 'repair',
      due_date: new Date('2024-12-31'),
      customer_name: 'John Doe',
      customer_phone: '555-1234',
      estimated_time: 2,
      technician_id: '123e4567-e89b-12d3-a456-426614174001',
      created_at: now,
      updated_at: now,
      version: 1,
    };

    const result = tasksSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate all status values', () => {
    const now = new Date();
    const statuses: Array<'assigned' | 'in_progress' | 'completed'> = [
      'assigned',
      'in_progress',
      'completed',
    ];

    statuses.forEach((status) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Task',
        description: 'Test Description',
        address: '123 Test St',
        latitude: null,
        longitude: null,
        status,
        priority: 'medium',
        category: 'repair',
        due_date: new Date('2024-12-31'),
        customer_name: 'John Doe',
        customer_phone: '555-1234',
        estimated_time: 2,
        technician_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      };

      const result = tasksSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  it('should validate all priority values', () => {
    const now = new Date();
    const priorities: Array<'low' | 'medium' | 'high' | 'urgent'> = [
      'low',
      'medium',
      'high',
      'urgent',
    ];

    priorities.forEach((priority) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Task',
        description: 'Test Description',
        address: '123 Test St',
        latitude: null,
        longitude: null,
        status: 'assigned',
        priority,
        category: 'repair',
        due_date: new Date('2024-12-31'),
        customer_name: 'John Doe',
        customer_phone: '555-1234',
        estimated_time: 2,
        technician_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      };

      const result = tasksSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  it('should validate all category values', () => {
    const now = new Date();
    const categories: Array<'repair' | 'installation' | 'maintenance' | 'inspection'> = [
      'repair',
      'installation',
      'maintenance',
      'inspection',
    ];

    categories.forEach((category) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Task',
        description: 'Test Description',
        address: '123 Test St',
        latitude: null,
        longitude: null,
        status: 'assigned',
        priority: 'medium',
        category,
        due_date: new Date('2024-12-31'),
        customer_name: 'John Doe',
        customer_phone: '555-1234',
        estimated_time: 2,
        technician_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      };

      const result = tasksSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

describe('reports schema', () => {
  it('should validate select schema', () => {
    const now = new Date();
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      task_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'draft',
      photos: ['photo1.jpg', 'photo2.jpg'],
      form_data: { field1: 'value1', field2: 123 },
      signature: null,
      pdf_url: null,
      created_at: now,
      updated_at: now,
      version: 1,
    };

    const result = reportsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate all status values', () => {
    const now = new Date();
    const statuses: Array<'draft' | 'completed' | 'synced'> = ['draft', 'completed', 'synced'];

    statuses.forEach((status) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        task_id: '123e4567-e89b-12d3-a456-426614174001',
        status,
        photos: [],
        form_data: {},
        signature: null,
        pdf_url: null,
        created_at: now,
        updated_at: now,
        version: 1,
      };

      const result = reportsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

describe('locations schema', () => {
  it('should validate select schema', () => {
    const now = new Date();
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      technician_id: '123e4567-e89b-12d3-a456-426614174001',
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 5.5,
      timestamp: new Date(),
      created_at: now,
    };

    const result = locationsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('parts schema', () => {
  it('should validate select schema', () => {
    const now = new Date();
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Circuit Breaker',
      description: '16A Circuit Breaker',
      barcode: '1234567890123',
      price: '25.99',
      stock: 10,
      category: 'electrical',
      created_at: now,
      updated_at: now,
    };

    const result = partsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('syncQueue schema', () => {
  it('should validate select schema', () => {
    const now = new Date();
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      type: 'task',
      action: 'create',
      data: { id: '123', title: 'Test' },
      version: 1,
      status: 'pending',
      error: null,
      created_at: now,
      updated_at: now,
    };

    const result = syncQueueSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate all type values', () => {
    const now = new Date();
    const types: Array<'task' | 'report' | 'location'> = ['task', 'report', 'location'];

    types.forEach((type) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        type,
        action: 'create',
        data: {},
        version: 1,
        status: 'pending',
        error: null,
        created_at: now,
        updated_at: now,
      };

      const result = syncQueueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  it('should validate all action values', () => {
    const now = new Date();
    const actions: Array<'create' | 'update' | 'delete'> = ['create', 'update', 'delete'];

    actions.forEach((action) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'task',
        action,
        data: {},
        version: 1,
        status: 'pending',
        error: null,
        created_at: now,
        updated_at: now,
      };

      const result = syncQueueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  it('should validate all status values', () => {
    const now = new Date();
    const statuses: Array<'pending' | 'synced' | 'failed'> = ['pending', 'synced', 'failed'];

    statuses.forEach((status) => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'task',
        action: 'create',
        data: {},
        version: 1,
        status,
        error: null,
        created_at: now,
        updated_at: now,
      };

      const result = syncQueueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});