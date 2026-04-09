import { describe, expect, it } from 'vitest';
import { getTaskSharedTransitionTag } from '@/lib/task-shared-transition';

describe('getTaskSharedTransitionTag', () => {
  it('returns stable shared transition tag for task id', () => {
    expect(getTaskSharedTransitionTag('task-123')).toBe('task-card-task-123');
  });
});
