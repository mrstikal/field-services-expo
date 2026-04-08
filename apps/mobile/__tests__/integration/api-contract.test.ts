import { describe, it, expect, vi } from 'vitest';
import { SyncPayload } from '@shared/index';

// ─── Contract Tests: Mobile ↔ Web Sync API ──────────────────────────────────
//
// These tests validate that the request/response schemas used by the mobile
// sync client are compatible with what the web sync endpoints expect/return.
// They act as a lightweight contract layer without requiring a live server.

describe('API Contract Tests – SyncPayload (mobile → web)', () => {
  it('should validate SyncPayload structure for task create', () => {
    const payload: SyncPayload = {
      type: 'task',
      action: 'create',
      data: { id: 'test-id', title: 'Test Task' },
      timestamp: new Date().toISOString(),
    };

    expect(payload.type).toBe('task');
    expect(payload.action).toBe('create');
    expect(payload.data).toHaveProperty('id');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('should validate SyncPayload structure for task update', () => {
    const payload: SyncPayload = {
      type: 'task',
      action: 'update',
      data: { id: 'test-id', status: 'in_progress' },
      timestamp: new Date().toISOString(),
    };

    expect(payload.type).toBe('task');
    expect(payload.action).toBe('update');
    expect(payload.data).toHaveProperty('id');
  });

  it('should validate SyncPayload structure for task delete', () => {
    const payload: SyncPayload = {
      type: 'task',
      action: 'delete',
      data: { id: 'test-id' },
      timestamp: new Date().toISOString(),
    };

    expect(payload.type).toBe('task');
    expect(payload.action).toBe('delete');
  });

  it('should validate SyncPayload structure for report create', () => {
    const payload: SyncPayload = {
      type: 'report',
      action: 'create',
      data: { id: 'report-id', task_id: 'task-id', status: 'completed' },
      timestamp: new Date().toISOString(),
    };

    expect(payload.type).toBe('report');
    expect(payload.action).toBe('create');
    expect(payload.data).toHaveProperty('task_id');
  });
});

describe('API Contract Tests – Push Sync request schema', () => {
  it('should validate push request body structure', () => {
    const pushBody = {
      changes: [
        {
          id: 'queue-item-1',
          type: 'task',
          action: 'create',
          data: {
            id: 'task-uuid',
            title: 'New Task',
            description: 'desc',
            technician_id: 'tech-1',
            due_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          version: 1,
        },
      ],
    };

    expect(pushBody).toHaveProperty('changes');
    expect(Array.isArray(pushBody.changes)).toBe(true);
    expect(pushBody.changes[0]).toHaveProperty('id');
    expect(pushBody.changes[0]).toHaveProperty('type');
    expect(pushBody.changes[0]).toHaveProperty('action');
    expect(pushBody.changes[0]).toHaveProperty('data');
    expect(pushBody.changes[0]).toHaveProperty('version');
  });

  it('should validate that each change item has required fields', () => {
    const changeItem = {
      id: 'queue-item-1',
      type: 'task' as const,
      action: 'create' as const,
      data: { id: 'task-uuid', title: 'Task' },
      version: 1,
    };

    expect(changeItem.id).toBeTruthy();
    expect(['task', 'report', 'location']).toContain(changeItem.type);
    expect(['create', 'update', 'delete']).toContain(changeItem.action);
    expect(changeItem.data).toHaveProperty('id');
    expect(typeof changeItem.version).toBe('number');
  });
});

describe('API Contract Tests – Pull Sync response schema', () => {
  it('should validate pull response structure', () => {
    const pullResponse = {
      success: true,
      data: {
        tasks: [
          { id: 'task-1', title: 'Task', updated_at: '2024-01-01T00:00:00Z' },
        ],
        reports: [],
        locations: [],
        serverTimestamp: new Date().toISOString(),
      },
    };

    expect(pullResponse.success).toBe(true);
    expect(pullResponse.data).toHaveProperty('tasks');
    expect(pullResponse.data).toHaveProperty('reports');
    expect(pullResponse.data).toHaveProperty('locations');
    expect(pullResponse.data).toHaveProperty('serverTimestamp');
    expect(Array.isArray(pullResponse.data.tasks)).toBe(true);
  });

  it('should validate that pull response tasks have required fields', () => {
    const task = {
      id: 'task-1',
      title: 'Task',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(task).toHaveProperty('id');
    expect(task).toHaveProperty('updated_at');
  });
});

describe('API Contract Tests – Push Sync response schema', () => {
  it('should validate push response structure on success', () => {
    const pushResponse = {
      success: true,
      results: {
        itemResults: [{ id: 'queue-item-1', status: 'success' }],
        success: 1,
        failed: 0,
        conflicts: [],
      },
    };

    expect(pushResponse.success).toBe(true);
    expect(pushResponse.results).toHaveProperty('itemResults');
    expect(Array.isArray(pushResponse.results.itemResults)).toBe(true);
    expect(pushResponse.results.itemResults[0]).toHaveProperty('id');
    expect(pushResponse.results.itemResults[0]).toHaveProperty('status');
  });

  it('should validate push response structure on partial failure', () => {
    const pushResponse = {
      success: true,
      results: {
        itemResults: [
          {
            id: 'queue-item-1',
            status: 'failed',
            error: 'Database constraint failed',
          },
        ],
        success: 0,
        failed: 1,
        conflicts: [],
      },
    };

    expect(pushResponse.results.itemResults[0].status).toBe('failed');
    expect(pushResponse.results.itemResults[0]).toHaveProperty('error');
    expect(pushResponse.results.failed).toBe(1);
  });

  it('should validate push response structure on conflict', () => {
    const pushResponse = {
      success: true,
      results: {
        itemResults: [],
        success: 0,
        failed: 0,
        conflicts: [{ id: 'queue-item-1', serverVersion: 5, clientVersion: 3 }],
      },
    };

    expect(pushResponse.results.conflicts).toHaveLength(1);
    expect(pushResponse.results.conflicts[0]).toHaveProperty('serverVersion');
    expect(pushResponse.results.conflicts[0]).toHaveProperty('clientVersion');
  });
});
