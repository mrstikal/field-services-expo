import { describe, expect, it } from 'vitest';
import { filterTasksWithoutReports } from '../task-selector.utils';
import type { Task } from '@field-service/shared-types';

function createTask(id: string): Task {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    title: `Task ${id}`,
    description: 'Description',
    address: 'Address',
    latitude: 50,
    longitude: 14,
    status: 'assigned',
    priority: 'medium',
    category: 'repair',
    due_date: now,
    customer_name: 'Customer',
    customer_phone: '123456789',
    estimated_time: 60,
    technician_id: 'tech-1',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
  };
}

describe('filterTasksWithoutReports', () => {
  it('removes tasks that already have reports', () => {
    const tasks = [createTask('t1'), createTask('t2'), createTask('t3')];
    const reportedIds = new Set(['t2']);

    const result = filterTasksWithoutReports(tasks, reportedIds);

    expect(result.map(task => task.id)).toEqual(['t1', 't3']);
  });

  it('returns all tasks when no reports exist', () => {
    const tasks = [createTask('t1'), createTask('t2')];

    const result = filterTasksWithoutReports(tasks, new Set());

    expect(result).toHaveLength(2);
  });
});
