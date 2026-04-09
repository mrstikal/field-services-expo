import { describe, expect, it } from 'vitest';
import { mapReportsToListItems } from '../reports-list.utils';
import type { LocalReport } from '@field-service/shared-types';

function createReport(
  id: string,
  taskId: string,
  status: LocalReport['status']
): LocalReport {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    task_id: taskId,
    status,
    photos: [],
    form_data: {},
    signature: null,
    pdf_url: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    synced: 1,
  };
}

describe('mapReportsToListItems', () => {
  it('maps report task titles from lookup table', () => {
    const reports = [createReport('r1', 't1', 'completed')];
    const taskTitles = new Map([['t1', 'Replace meter']]);

    const result = mapReportsToListItems(reports, taskTitles);

    expect(result).toEqual([
      {
        id: 'r1',
        task_id: 't1',
        taskTitle: 'Replace meter',
        status: 'completed',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('uses fallback when task title is missing', () => {
    const reports = [createReport('r1', 'missing-task', 'draft')];

    const result = mapReportsToListItems(reports, new Map());

    expect(result[0]?.taskTitle).toBe('Unknown');
  });
});
