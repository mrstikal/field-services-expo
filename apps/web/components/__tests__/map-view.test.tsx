import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MapView from '../map-view';
import { supabase } from '@/lib/supabase';

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

// Mock react-map-gl/mapbox
vi.mock('react-map-gl/mapbox', () => ({
  __esModule: true,
  default: vi.fn(({ children, onMove, initialViewState }: any) => (
    <div data-testid="mock-map" data-initial-lat={initialViewState.latitude} data-initial-lng={initialViewState.longitude}>
      {children}
      <button data-testid="mock-map-move" onClick={() => onMove({ viewState: { latitude: 1, longitude: 1, zoom: 1 } })} />
    </div>
  )),
  Marker: vi.fn(({ children, latitude, longitude, onClick }: any) => (
    <div data-testid="mock-marker" data-lat={latitude} data-lng={longitude} onClick={onClick}>
      {children}
    </div>
  )),
  Popup: vi.fn(({ children, latitude, longitude, onClose }: any) => (
    <div data-testid="mock-popup" data-lat={latitude} data-lng={longitude}>
      {children}
      <button data-testid="mock-popup-close" onClick={onClose}>Close</button>
    </div>
  )),
  NavigationControl: vi.fn(() => <div data-testid="mock-navigation-control" />),
  GeolocateControl: vi.fn(() => <div data-testid="mock-geolocate-control" />),
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
        })),
        then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      })),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('MapView', () => {
  const mockTechnicians = [
    {
      id: 'tech1',
      name: 'Tech One',
      email: 'tech1@example.com',
      is_online: true,
      last_location: { latitude: 49.75, longitude: 15.47 },
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'tech2',
      name: 'Tech Two',
      email: 'tech2@example.com',
      is_online: false,
      last_location: { latitude: 49.76, longitude: 15.48 },
      created_at: '2024-01-01T09:00:00Z',
    },
  ];

  const mockTasks = [
    { id: 'task1', title: 'Task One', latitude: 49.75, longitude: 15.47, status: 'assigned', technician_id: 'tech1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as any).mockImplementation((tableName: any) => {
      if (tableName === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: mockTechnicians, error: null })),
          })),
        };
      } else if (tableName === 'tasks') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: mockTasks, error: null })),
          })),
        };
      }
      return {};
    });
  });

  it('should render the map and controls', async () => {
    render(<MapView />);
    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument();
      expect(screen.getByTestId('mock-navigation-control')).toBeInTheDocument();
      expect(screen.getByTestId('mock-geolocate-control')).toBeInTheDocument();
    });
  });

  it('should load technicians and display markers', async () => {
    render(<MapView />);
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(screen.getAllByTestId('mock-marker')).toHaveLength(2); // 1 geofence + 1 clustered technician marker
      expect(screen.getByText('2')).toBeInTheDocument(); // Clustered technicians count
    });
  });

  it('should show popup on technician marker click', async () => {
    render(<MapView />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('2'));
    await waitFor(() => {
      expect(screen.getAllByText('T')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByText('T')[0]);
    expect(screen.getByTestId('mock-popup')).toBeInTheDocument();
    expect(screen.getByText('Tech One')).toBeInTheDocument();
  });

  it('should close popup on close button click', async () => {
    render(<MapView />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('2'));
    await waitFor(() => {
      expect(screen.getAllByText('T')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByText('T')[0]);
    expect(screen.getByTestId('mock-popup')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-popup-close'));
    expect(screen.queryByTestId('mock-popup')).toBeNull();
  });

  it('should handle real-time updates for technicians', async () => {
    let onUpdateCallback: any;
    (supabase.channel as any).mockReturnValue({
      on: vi.fn((event: any, filter: any, callback: any) => {
        if (event === 'postgres_changes' && filter.table === 'users') {
          onUpdateCallback = callback;
        }
        return { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) };
      }),
    });

    render(<MapView />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    // Simulate a real-time update
    const updatedTechnician = {
      ...mockTechnicians[0],
      is_online: false,
      last_location: { latitude: 50, longitude: 16 },
    };
    act(() => {
      onUpdateCallback({ new: updatedTechnician });
    });

    await waitFor(() => {
      expect(screen.queryByText('2')).toBeNull();
      expect(screen.getAllByText('T')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByText('T')[0]);

    await waitFor(() => {
      expect(screen.getByText(/Offline/)).toBeInTheDocument();
    });
  });
});
