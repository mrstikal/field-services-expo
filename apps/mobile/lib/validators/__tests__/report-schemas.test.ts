import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import {
  formTemplates,
  createReportSchema,
} from '../report-schemas';
import { TaskCategory } from '@field-service/shared-types';

describe('formTemplates', () => {
  it('should have all task categories', () => {
    const categories: Array<TaskCategory> = ['repair', 'installation', 'maintenance', 'inspection'];

    categories.forEach((category) => {
      expect(formTemplates[category]).toBeDefined();
      expect(formTemplates[category].name).toBeDefined();
      expect(Array.isArray(formTemplates[category].fields)).toBe(true);
    });
  });

  it('should have correct repair template', () => {
    const template = formTemplates.repair;

    expect(template.name).toBe('Repair Report');
    expect(template.fields).toHaveLength(8);

    const requiredFields = template.fields.filter((f) => f.required);
    expect(requiredFields).toHaveLength(3);
  });

  it('should have correct installation template', () => {
    const template = formTemplates.installation;

    expect(template.name).toBe('Installation Report');
    expect(template.fields).toHaveLength(8);

    const requiredFields = template.fields.filter((f) => f.required);
    expect(requiredFields).toHaveLength(2);
  });

  it('should have correct maintenance template', () => {
    const template = formTemplates.maintenance;

    expect(template.name).toBe('Maintenance Report');
    expect(template.fields).toHaveLength(7);

    const requiredFields = template.fields.filter((f) => f.required);
    expect(requiredFields).toHaveLength(3);
  });

  it('should have correct inspection template', () => {
    const template = formTemplates.inspection;

    expect(template.name).toBe('Inspection Report');
    expect(template.fields).toHaveLength(7);

    const requiredFields = template.fields.filter((f) => f.required);
    expect(requiredFields).toHaveLength(3);
  });
});

describe('createReportSchema', () => {
  it('should generate repair schema', () => {
    const schema = createReportSchema('repair');

    expect(schema).toBeInstanceOf(z.ZodObject);

    const validData = {
      fault_type: 'electrical',
      fault_description: 'Circuit breaker tripping',
      voltage: 240,
      current: 16,
      parts_replaced: 'Circuit breaker 16A',
      repair_time: 2,
      test_results: 'passed',
      additional_notes: 'Replaced faulty breaker',
    };

    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid repair schema', () => {
    const schema = createReportSchema('repair');

    const invalidData = {
      fault_type: 'electrical',
      fault_description: '', // empty string should fail
      voltage: 240,
      current: 16,
      parts_replaced: 'Circuit breaker 16A',
      repair_time: 2,
      test_results: 'passed',
    };

    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should generate installation schema', () => {
    const schema = createReportSchema('installation');

    const validData = {
      installation_type: 'new',
      equipment_installed: 'Distribution board 100A',
      cable_type: '2.5mm² TW',
      cable_length: 50,
      number_of_outlets: 10,
      number_of_switches: 5,
      installation_test_passed: true,
      compliance_notes: 'Compliant with IEC 60364',
    };

    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should generate maintenance schema', () => {
    const schema = createReportSchema('maintenance');

    const validData = {
      maintenance_type: 'preventive',
      maintenance_items: 'Inspection and cleaning',
      issues_found: 'none',
      actions_taken: 'Cleaned contacts',
      recommended_actions: 'Replace contacts in 6 months',
      next_maintenance_date: '2025-01-01',
      maintenance_time: 1.5,
    };

    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should generate inspection schema', () => {
    const schema = createReportSchema('inspection');

    const validData = {
      inspection_type: 'safety',
      inspection_areas: 'Main panel and circuits',
      compliance_status: 'compliant',
      deficiencies: 'None',
      corrective_actions: 'None',
      inspection_passed: true,
      inspector_comments: 'All good',
    };

    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('ReportFormValues type inference', () => {
  it('should infer correct type from repair schema', () => {
    type SchemaForType = ReturnType<typeof createReportSchema>;
    type FormValues = z.infer<SchemaForType>;

    const data: FormValues = {
      fault_type: 'electrical',
      fault_description: 'Test',
      voltage: 240,
      current: 16,
      parts_replaced: 'Part',
      repair_time: 2,
      test_results: 'passed',
      additional_notes: 'Notes',
    };

    expect(data).toBeDefined();
  });
});