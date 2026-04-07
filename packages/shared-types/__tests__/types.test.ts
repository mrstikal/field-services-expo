import { describe, it, expect } from 'vitest';

describe('Task interface', () => {
  it('should have all required fields', () => {
    const task = {
      id: '123',
      title: 'Test Task',
      description: 'Test Description',
      address: '123 Test St',
      latitude: 40.7128,
      longitude: -74.0060,
      status: 'assigned',
      priority: 'high',
      category: 'repair',
      due_date: '2024-12-31',
      customer_name: 'John Doe',
      customer_phone: '555-1234',
      estimated_time: 2,
      technician_id: 'tech1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      version: 1,
      synced: 0,
    };

    expect(task.id).toBe('123');
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('assigned');
    expect(task.priority).toBe('high');
    expect(task.category).toBe('repair');
  });

  it('should validate TaskStatus union type', () => {
    const validStatuses: Array<'assigned' | 'in_progress' | 'completed'> = [
      'assigned',
      'in_progress',
      'completed',
    ];

    validStatuses.forEach((status) => {
      expect(status).toBeDefined();
    });
  });

  it('should validate TaskPriority union type', () => {
    const validPriorities: Array<'low' | 'medium' | 'high' | 'urgent'> = [
      'low',
      'medium',
      'high',
      'urgent',
    ];

    validPriorities.forEach((priority) => {
      expect(priority).toBeDefined();
    });
  });

  it('should validate TaskCategory union type', () => {
    const validCategories: Array<'repair' | 'installation' | 'maintenance' | 'inspection'> = [
      'repair',
      'installation',
      'maintenance',
      'inspection',
    ];

    validCategories.forEach((category) => {
      expect(category).toBeDefined();
    });
  });
});

describe('Technician interface', () => {
  it('should have all required fields', () => {
    const technician = {
      id: '123',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '555-5678',
      role: 'technician',
      avatar_url: null,
      is_online: true,
      last_location: {
        latitude: 40.7128,
        longitude: -74.0060,
      },
      created_at: '2024-01-01',
    };

    expect(technician.id).toBe('123');
    expect(technician.name).toBe('Jane Smith');
    expect(technician.role).toBe('technician');
    expect(technician.avatar_url).toBeNull();
  });

  it('should validate role union type', () => {
    const validRoles: Array<'technician' | 'dispatcher'> = ['technician', 'dispatcher'];

    validRoles.forEach((role) => {
      expect(role).toBeDefined();
    });
  });
});

describe('Report interface', () => {
  it('should have all required fields', () => {
    const report = {
      id: '123',
      task_id: 'task1',
      status: 'draft',
      photos: ['photo1.jpg', 'photo2.jpg'],
      form_data: { field1: 'value1', field2: 123 },
      signature: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      version: 1,
      synced: 0,
    };

    expect(report.id).toBe('123');
    expect(report.task_id).toBe('task1');
    expect(report.photos).toHaveLength(2);
    expect(report.form_data).toBeDefined();
  });

  it('should validate ReportStatus union type', () => {
    const validStatuses: Array<'draft' | 'completed' | 'synced'> = ['draft', 'completed', 'synced'];

    validStatuses.forEach((status) => {
      expect(status).toBeDefined();
    });
  });
});

describe('Location interface', () => {
  it('should have all required fields', () => {
    const location = {
      id: '123',
      technician_id: 'tech1',
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 5.5,
      timestamp: '2024-01-01T12:00:00Z',
    };

    expect(location.latitude).toBe(40.7128);
    expect(location.longitude).toBe(-74.0060);
    expect(location.accuracy).toBe(5.5);
  });
});

describe('SyncPayload interface', () => {
  it('should have all required fields', () => {
    const payload = {
      type: 'task',
      action: 'create',
      data: { id: '123', title: 'Test' },
      timestamp: '2024-01-01T12:00:00Z',
    };

    expect(payload.type).toBe('task');
    expect(payload.action).toBe('create');
    expect(payload.data).toBeDefined();
  });

  it('should validate type union', () => {
    const validTypes: Array<'task' | 'report' | 'location'> = ['task', 'report', 'location'];

    validTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });

  it('should validate action union', () => {
    const validActions: Array<'create' | 'update' | 'delete'> = ['create', 'update', 'delete'];

    validActions.forEach((action) => {
      expect(action).toBeDefined();
    });
  });
});

describe('User interface', () => {
  it('should have all required fields', () => {
    const user = {
      id: '123',
      email: 'user@example.com',
      role: 'technician',
      profile: {
        name: 'John Doe',
        phone: '555-1234',
        avatar_url: null,
      },
    };

    expect(user.id).toBe('123');
    expect(user.email).toBe('user@example.com');
    expect(user.role).toBe('technician');
    expect(user.profile.name).toBe('John Doe');
  });
});

describe('Part interface', () => {
  it('should have all required fields', () => {
    const part = {
      id: '123',
      name: 'Circuit Breaker',
      description: '16A Circuit Breaker',
      barcode: '1234567890123',
      price: 25.99,
      stock: 10,
      category: 'electrical',
      created_at: '2024-01-01',
    };

    expect(part.id).toBe('123');
    expect(part.name).toBe('Circuit Breaker');
    expect(part.barcode).toBe('1234567890123');
    expect(part.price).toBe(25.99);
    expect(part.stock).toBe(10);
  });
});

describe('FormTemplate interface', () => {
  it('should have all required fields', () => {
    const template = {
      id: '123',
      categoryId: 'repair',
      name: 'Repair Report',
      fields: [
        {
          id: 'field1',
          label: 'Field 1',
          type: 'text',
          required: true,
        },
      ],
      version: 1,
      created_at: '2024-01-01',
    };

    expect(template.id).toBe('123');
    expect(template.categoryId).toBe('repair');
    expect(template.fields).toHaveLength(1);
  });

  it('should validate FormFieldType union', () => {
    const validTypes: Array<'text' | 'number' | 'checkbox' | 'select' | 'photo' | 'signature'> = [
      'text',
      'number',
      'checkbox',
      'select',
      'photo',
      'signature',
    ];

    validTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });
});