import type { Task } from '@field-service/shared-types';

export function filterTasksWithoutReports(
  tasks: Task[],
  reportedTaskIds: ReadonlySet<string>
): Task[] {
  return tasks.filter(task => !reportedTaskIds.has(task.id));
}
