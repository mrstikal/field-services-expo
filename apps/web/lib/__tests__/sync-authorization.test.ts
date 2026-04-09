import { canMutateReport, canMutateTask } from '@/lib/sync-authorization';

describe('sync-authorization', () => {
  it('allows dispatcher to mutate any task/report', () => {
    expect(
      canMutateTask('dispatcher', 'dispatcher-1', {
        existingTechnicianId: 'tech-2',
      })
    ).toBe(true);
    expect(canMutateReport('dispatcher', 'dispatcher-1', 'tech-2')).toBe(true);
  });

  it('allows technician to mutate only own task', () => {
    expect(
      canMutateTask('technician', 'tech-1', { existingTechnicianId: 'tech-1' })
    ).toBe(true);
    expect(
      canMutateTask('technician', 'tech-1', { existingTechnicianId: 'tech-2' })
    ).toBe(false);
  });

  it('allows technician to mutate report only when task belongs to technician', () => {
    expect(canMutateReport('technician', 'tech-1', 'tech-1')).toBe(true);
    expect(canMutateReport('technician', 'tech-1', 'tech-2')).toBe(false);
    expect(canMutateReport('technician', 'tech-1', null)).toBe(false);
  });
});
