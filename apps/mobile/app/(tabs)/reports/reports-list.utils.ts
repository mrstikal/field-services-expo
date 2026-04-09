import type { LocalReport } from '@field-service/shared-types';

export interface ReportListItem {
  id: string;
  task_id: string;
  taskTitle: string;
  status: LocalReport['status'];
  created_at: string;
  updated_at: string;
}

export function mapReportsToListItems(
  reports: LocalReport[],
  taskTitlesById: ReadonlyMap<string, string>
): ReportListItem[] {
  return reports.map(report => ({
    id: report.id,
    task_id: report.task_id,
    taskTitle: taskTitlesById.get(report.task_id) ?? 'Unknown',
    status: report.status,
    created_at: report.created_at,
    updated_at: report.updated_at,
  }));
}
