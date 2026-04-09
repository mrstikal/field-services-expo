import type { BusinessRole } from '@field-service/shared-types';

export function canMutateTask(
  role: BusinessRole,
  userId: string,
  options: {
    existingTechnicianId?: string | null;
    incomingTechnicianId?: string | null;
  }
) {
  if (role !== 'technician') {
    return true;
  }

  if (options.existingTechnicianId !== undefined) {
    return options.existingTechnicianId === userId;
  }

  if (options.incomingTechnicianId !== undefined) {
    return options.incomingTechnicianId === userId;
  }

  return false;
}

export function canMutateReport(
  role: BusinessRole,
  userId: string,
  taskTechnicianId?: string | null
) {
  if (role !== 'technician') {
    return true;
  }

  return taskTechnicianId === userId;
}
