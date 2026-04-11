import { GET } from '@/app/api/dashboard/badges/route';
import { getAppUserProfile, isDispatcher } from '@/lib/server-auth';
import { requireRequestUser } from '@/lib/server-supabase';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server-supabase', () => ({
  requireRequestUser: vi.fn(),
}));

vi.mock('@/lib/server-auth', () => ({
  getAppUserProfile: vi.fn(),
  isDispatcher: vi.fn(),
}));

vi.mock('@/lib/api-errors', () => ({
  logApiError: vi.fn(),
}));

const mockedRequireRequestUser = vi.mocked(requireRequestUser);
const mockedGetAppUserProfile = vi.mocked(getAppUserProfile);
const mockedIsDispatcher = vi.mocked(isDispatcher);

function createRequest(search: string) {
  return new NextRequest(`https://example.test/api/dashboard/badges?${search}`);
}

describe('Dashboard badges API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAppUserProfile.mockResolvedValue({ role: 'dispatcher' } as never);
    mockedIsDispatcher.mockReturnValue(true);
  });

  it('counts task badge updates using updated_at', async () => {
    const taskGt = vi.fn();
    const taskQuery = {
      gt: vi.fn((column: string, value: string) => {
        taskGt(column, value);
        return taskQuery;
      }),
      is: vi.fn().mockResolvedValue({ count: 3, error: null }),
    };
    const techniciansGt = vi.fn().mockResolvedValue({ count: 0, error: null });
    const techniciansQuery = {
      eq: vi.fn(() => techniciansQuery),
      gt: techniciansGt,
    };
    const reportsQuery = {
      gt: vi.fn(() => reportsQuery),
      is: vi.fn().mockResolvedValue({ count: 0, error: null }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn(() => taskQuery),
          };
        }

        if (table === 'users') {
          return {
            select: vi.fn(() => techniciansQuery),
          };
        }

        if (table === 'reports') {
          return {
            select: vi.fn(() => reportsQuery),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    mockedRequireRequestUser.mockResolvedValue({
      supabase,
      user: { id: 'dispatcher-1' },
      error: null,
    } as never);

    const response = await GET(
      createRequest(
        [
          'tasksSince=2026-04-12T09:00:00.000Z',
          'techniciansSince=2026-04-12T09:00:00.000Z',
          'reportsSince=2026-04-12T09:00:00.000Z',
        ].join('&')
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tasks).toBe(3);
    expect(taskGt).toHaveBeenCalledWith(
      'updated_at',
      '2026-04-12T09:00:00.000Z'
    );
    expect(taskGt).not.toHaveBeenCalledWith(
      'created_at',
      '2026-04-12T09:00:00.000Z'
    );
  });
});
