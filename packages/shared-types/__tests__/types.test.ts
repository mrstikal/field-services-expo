import { describe, it, expect } from 'vitest';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  Technician,
  Report,
  ReportStatus,
  Location,
  SyncPayload,
  User,
  Part,
  FormFieldType,
  FormField,
  FormTemplate,
  ReportFormData,
} from '../index';

// Helper functions for type assertion
function assertType<T>(value: T) {
  // This function does nothing at runtime, it's purely for compile-time type checking
}

describe('Shared Types', () => {
  describe('Task types', () => {
    it('should satisfy strict Task interface', () => {
      const task: Task = {
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
      expect(task).toBeDefined();
      
      // Negative tests for robust type validation
      // @ts-expect-error - latitude must be number
      const invalidLatitude: Task = { ...task, latitude: 'invalid' };
      // @ts-expect-error - version must be number
      const invalidVersion: Task = { ...task, version: '1' };
      // @ts-expect-error - missing required field
      const missingField: Task = { id: '1' };
      // @ts-expect-error - unknown category
      const invalidCategory: Task = { ...task, category: 'unknown' };
    });

    it('should validate TaskStatus union type', () => {
      assertType<TaskStatus>('assigned');
      assertType<TaskStatus>('in_progress');
      assertType<TaskStatus>('completed');
      // @ts-expect-error - Invalid TaskStatus
      assertType<TaskStatus>('invalid_status');
    });

    it('should validate TaskPriority union type', () => {
      assertType<TaskPriority>('low');
      assertType<TaskPriority>('medium');
      assertType<TaskPriority>('high');
      assertType<TaskPriority>('urgent');
      // @ts-expect-error - Invalid TaskPriority
      assertType<TaskPriority>('critical');
    });

    it('should validate TaskCategory union type', () => {
      assertType<TaskCategory>('repair');
      assertType<TaskCategory>('installation');
      assertType<TaskCategory>('maintenance');
      assertType<TaskCategory>('inspection');
      // @ts-expect-error - Invalid TaskCategory
      assertType<TaskCategory>('other');
    });
  });

  describe('Technician types', () => {
    it('should correctly define Technician interface', () => {
      const technician: Technician = {
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
      assertType<Technician>(technician);
      // @ts-expect-error - Missing required field
      const invalidTechnician: Technician = { id: '1' };
      // @ts-expect-error - Invalid type for role
      const invalidTechnician2: Technician = { ...technician, role: 'admin' };
    });
  });

  describe('Report types', () => {
    it('should correctly define Report interface', () => {
      const report: Report = {
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
      assertType<Report>(report);
      // @ts-expect-error - Missing required field
      const invalidReport: Report = { id: '1' };
      // @ts-expect-error - Invalid type for status
      const invalidReport2: Report = { ...report, status: 'pending' };
    });

    it('should validate ReportStatus union type', () => {
      assertType<ReportStatus>('draft');
      assertType<ReportStatus>('completed');
      assertType<ReportStatus>('synced');
      // @ts-expect-error - Invalid ReportStatus
      assertType<ReportStatus>('in_progress');
    });
  });

  describe('Location types', () => {
    it('should correctly define Location interface', () => {
      const location: Location = {
        id: '123',
        technician_id: 'tech1',
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5.5,
        timestamp: '2024-01-01T12:00:00Z',
      };
      assertType<Location>(location);
      // @ts-expect-error - Missing required field
      const invalidLocation: Location = { id: '1' };
      // @ts-expect-error - Invalid type for latitude
      const invalidLocation2: Location = { ...location, latitude: 'invalid' };
    });
  });

  describe('SyncPayload types', () => {
    it('should correctly define SyncPayload interface', () => {
      const payload: SyncPayload = {
        type: 'task',
        action: 'create',
        data: { id: '123', title: 'Test' },
        timestamp: '2024-01-01T12:00:00Z',
      };
      assertType<SyncPayload>(payload);
      // @ts-expect-error - Missing required field
      const invalidPayload: SyncPayload = { type: 'task' };
      // @ts-expect-error - Invalid type for action
      const invalidPayload2: SyncPayload = { ...payload, action: 'read' };
    });

    it('should validate type union', () => {
      assertType<SyncPayload['type']>('task');
      assertType<SyncPayload['type']>('report');
      assertType<SyncPayload['type']>('location');
      // @ts-expect-error - Invalid SyncPayload type
      assertType<SyncPayload['type']>('user');
    });

    it('should validate action union', () => {
      assertType<SyncPayload['action']>('create');
      assertType<SyncPayload['action']>('update');
      assertType<SyncPayload['action']>('delete');
      // @ts-expect-error - Invalid SyncPayload action
      assertType<SyncPayload['action']>('read');
    });
  });

  describe('User types', () => {
    it('should correctly define User interface', () => {
      const user: User = {
        id: '123',
        email: 'user@example.com',
        role: 'technician',
        profile: {
          name: 'John Doe',
          phone: '555-1234',
          avatar_url: null,
        },
      };
      assertType<User>(user);
      // @ts-expect-error - Missing required field
      const invalidUser: User = { id: '1' };
      // @ts-expect-error - Invalid type for role
      const invalidUser2: User = { ...user, role: 'admin' };
    });
  });

  describe('Part types', () => {
    it('should correctly define Part interface', () => {
      const part: Part = {
        id: '123',
        name: 'Circuit Breaker',
        description: '16A Circuit Breaker',
        barcode: '1234567890123',
        price: 25.99,
        stock: 10,
        category: 'electrical',
        created_at: '2024-01-01',
      };
      assertType<Part>(part);
      // @ts-expect-error - Missing required field
      const invalidPart: Part = { id: '1' };
      // @ts-expect-error - Invalid type for price
      const invalidPart2: Part = { ...part, price: 'invalid' };
    });
  });

  describe('FormTemplate types', () => {
    it('should correctly define FormTemplate interface', () => {
      const template: FormTemplate = {
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
      assertType<FormTemplate>(template);
      // @ts-expect-error - Missing required field
      const invalidTemplate: FormTemplate = { id: '1' };
      // @ts-expect-error - Invalid type for categoryId
      const invalidTemplate2: FormTemplate = { ...template, categoryId: 'invalid' };
    });

    it('should validate FormFieldType union', () => {
      assertType<FormFieldType>('text');
      assertType<FormFieldType>('number');
      assertType<FormFieldType>('checkbox');
      assertType<FormFieldType>('select');
      assertType<FormFieldType>('photo');
      assertType<FormFieldType>('signature');
      // @ts-expect-error - Invalid FormFieldType
      assertType<FormFieldType>('date');
    });

    it('should correctly define FormField interface', () => {
      const formField: FormField = {
        id: 'field1',
        label: 'Field 1',
        type: 'text',
        required: true,
        placeholder: 'Enter text',
        options: [{ label: 'Option 1', value: '1' }],
        validation: { minLength: 5 },
        conditional: { fieldId: 'field2', value: true },
        defaultValue: 'default',
      };
      assertType<FormField>(formField);
      // @ts-expect-error - Missing required field
      const invalidFormField: FormField = { id: '1' };
    });
  });

  describe('ReportFormData types', () => {
    it('should correctly define ReportFormData interface', () => {
      const formData: ReportFormData = {
        field1: 'value1',
        field2: 123,
        field3: true,
        field4: ['item1', 'item2'],
      };
      assertType<ReportFormData>(formData);
      // @ts-expect-error - Invalid type for field
      const invalidFormData: ReportFormData = { field1: { nested: 'value' } };
    });
  });
});
