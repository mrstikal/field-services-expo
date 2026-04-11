import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { useQuery } from '@tanstack/react-query';
import { realtimeSyncService } from '@/lib/realtime-sync';

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="map-view" />,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock('@/lib/realtime-sync', () => ({
  realtimeSyncService: {
    subscribeToTasks: vi.fn(),
    subscribeToAllTechnicians: vi.fn(),
  },
}));

const mockedUseQuery = vi.mocked(useQuery);
const mockedRealtimeSyncService = vi.mocked(realtimeSyncService);

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRealtimeSyncService.subscribeToTasks.mockReturnValue({
      unsubscribe: vi.fn(),
    });
    mockedRealtimeSyncService.subscribeToAllTechnicians.mockReturnValue({
      unsubscribe: vi.fn(),
    });
    mockedUseQuery
      .mockReturnValueOnce({
        data: [
          {
            id: 'task-1',
            status: 'completed',
            due_date: '2026-04-12T10:00:00.000Z',
            deleted_at: null,
          },
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never)
      .mockReturnValueOnce({
        data: [{ id: 'tech-1', name: 'Tech', is_online: true }],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);
  });

  it('subscribes to realtime task updates on the overview page', () => {
    render(<DashboardPage />);

    expect(mockedRealtimeSyncService.subscribeToTasks).toHaveBeenCalledTimes(1);
    expect(
      mockedRealtimeSyncService.subscribeToAllTechnicians
    ).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
  });
});
