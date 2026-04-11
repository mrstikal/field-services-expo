'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import MapGL, {
  Marker,
  Popup,
  NavigationControl,
  GeolocateControl,
  MapRef,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Task, Technician as SharedTechnician } from '@field-service/shared-types';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { formatLastSeen, getLastSeenTimestamp } from './map-view.utils';
import { realtimeSyncService } from '@/lib/realtime-sync';

type Technician = SharedTechnician;

interface MapViewProps {
  readonly height?: string;
}

type TaskGeofence = Pick<Task, 'id' | 'title' | 'status'> & {
  latitude: number;
  longitude: number;
};
type DispatchableTask = Pick<Task, 'id' | 'title'>;

interface ClusterPoint {
  id: string;
  latitude: number;
  longitude: number;
  technicians: Technician[];
}

export default function MapView({ height }: MapViewProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] =
    useState<Technician | null>(null);
  const [technicianTaskCounts, setTechnicianTaskCounts] = useState<
    Record<string, number>
  >({});
  const [taskGeofences, setTaskGeofences] = useState<TaskGeofence[]>([]);
  const [dispatchableTasks, setDispatchableTasks] = useState<DispatchableTask[]>(
    []
  );
  const [selectedDispatchTaskId, setSelectedDispatchTaskId] = useState<
    string | null
  >(null);
  const [isPushingTask, setIsPushingTask] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);
  const [lastPushedTask, setLastPushedTask] = useState<DispatchableTask | null>(
    null
  );
  const [viewport, setViewport] = useState({
    latitude: 49.75,
    longitude: 15.47,
    zoom: 6,
    bearing: 0,
    pitch: 0,
  });
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const mapRef = useRef<MapRef>(null);

  // Only render MapGL after component is mounted on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (selectedTechnician && !selectedTechnician.last_location) {
      setSelectedTechnician(null);
    }
  }, [selectedTechnician]);

  const clusterPrecision = useMemo(
    () => (viewport.zoom < 7 ? 1 : viewport.zoom < 9 ? 2 : 3),
    [viewport.zoom]
  );
  const clusteredPoints = useMemo<ClusterPoint[]>(() => {
    const grouped = new Map<string, ClusterPoint>();

    technicians.forEach(technician => {
      if (!technician.last_location) {
        return;
      }

      const lat = technician.last_location.latitude;
      const lng = technician.last_location.longitude;
      const key = `${lat.toFixed(clusterPrecision)}:${lng.toFixed(clusterPrecision)}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          latitude: lat,
          longitude: lng,
          technicians: [technician],
        });
        return;
      }

      const existing = grouped.get(key);
      if (existing) {
        existing.technicians.push(technician);
      }
    });

    return Array.from(grouped.values());
  }, [technicians, clusterPrecision]);

  // The shared supabase client is module-scoped and stable for the lifetime of
  // the dashboard session, so an empty dependency list here is intentional.
  const loadActiveTasks = useCallback(async () => {
    const tasksResult = await supabase
      .from('tasks')
      .select('id, title, latitude, longitude, status, technician_id')
      .in('status', ['assigned', 'in_progress']);

    if (tasksResult.error) {
      console.error('Error loading task geofences:', tasksResult.error);
      return false;
    }

    if (tasksResult.data) {
      const counts = tasksResult.data.reduce<Record<string, number>>(
        (acc, task) => {
          const technicianId =
            typeof task.technician_id === 'string' ? task.technician_id : null;
          if (technicianId) {
            acc[technicianId] = (acc[technicianId] || 0) + 1;
          }
          return acc;
        },
        {}
      );
      setTechnicianTaskCounts(counts);

      const geofences = tasksResult.data.filter(
        task =>
          typeof task.latitude === 'number' && typeof task.longitude === 'number'
      ) as TaskGeofence[];
      setTaskGeofences(geofences);

      const unassigned = tasksResult.data.filter(
        task => task.status === 'assigned' && !task.technician_id
      ) as DispatchableTask[];
      setDispatchableTasks(unassigned);
    }

    return true;
  }, []);

  // Load technicians with locations
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        const usersResult = await supabase
          .from('users')
          .select('*')
          .eq('role', 'technician');

        const { data, error } = usersResult;
        if (error) {
          if (error.message === 'Invalid API key') {
            console.error(
              'Supabase API key is invalid. Please check NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
            );
          } else {
            console.error('Error loading technicians:', error);
          }
          return;
        }

        await loadActiveTasks();

        if (data) {
          setTechnicians(data as Technician[]);
        }
      } catch (error) {
        console.error('Error loading technicians:', error);
      }
    };

    loadTechnicians();

    // Set up real-time subscription
    const channel = supabase
      .channel('technicians-location')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: 'role=eq=technician',
        },
        payload => {
          setTechnicians(prev =>
            prev.map(tech =>
              tech.id === payload.new.id ? (payload.new as Technician) : tech
            )
          );
          setSelectedTechnician(prev =>
            prev && prev.id === payload.new.id ? (payload.new as Technician) : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadActiveTasks]);

  useEffect(() => {
    const tasksSubscription = realtimeSyncService.subscribeToTasks(() => {
      void loadActiveTasks();
    });

    return () => {
      tasksSubscription.unsubscribe();
    };
  }, [loadActiveTasks]);

  // Handle marker click
  const handleMarkerClick = (technician: Technician) => {
    setSelectedTechnician(technician);
    setPushError(null);
    setPushSuccess(null);
    setLastPushedTask(null);
    setSelectedDispatchTaskId(prev => prev ?? dispatchableTasks[0]?.id ?? null);
    // Center map on technician
    if (technician.last_location) {
      setViewport(prev => ({
        ...prev,
        latitude: technician.last_location!.latitude,
        longitude: technician.last_location!.longitude,
        zoom: Math.max(prev.zoom, 10),
      }));
    }
  };

  const handleClusterClick = (cluster: ClusterPoint) => {
    if (cluster.technicians.length === 1) {
      handleMarkerClick(cluster.technicians[0]);
      return;
    }

    setViewport(prev => ({
      ...prev,
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      zoom: Math.min(prev.zoom + 1, 13),
    }));
  };

  // Close popup
  const closePopup = () => {
    setSelectedTechnician(null);
    setPushError(null);
    setPushSuccess(null);
    setLastPushedTask(null);
    setSelectedDispatchTaskId(null);
  };

  const handlePushNextTask = async () => {
    if (!selectedTechnician || isPushingTask) {
      return;
    }

    const taskToPush = dispatchableTasks.find(
      task => task.id === selectedDispatchTaskId
    );
    if (!taskToPush) {
      return;
    }

    try {
      setIsPushingTask(true);
      setPushError(null);
      setPushSuccess(null);
      setLastPushedTask(null);
      const response = await authenticatedFetch(`/api/tasks/${taskToPush.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician_id: selectedTechnician.id,
          status: 'assigned',
        }),
      });

      if (!response.ok) {
        let message = 'Unable to push task.';
        try {
          const body = (await response.json()) as { error?: unknown };
          if (typeof body.error === 'string' && body.error.length > 0) {
            message = body.error;
          }
        } catch {
          // Keep fallback message when response body is not JSON.
        }
        throw new Error(message);
      }

      setDispatchableTasks(prev =>
        prev.filter(task => task.id !== taskToPush.id)
      );
      setTechnicianTaskCounts(prev => ({
        ...prev,
        [selectedTechnician.id]: (prev[selectedTechnician.id] || 0) + 1,
      }));
      setSelectedDispatchTaskId(prev => {
        if (prev === taskToPush.id) {
          const remainingTask = dispatchableTasks.find(
            task => task.id !== taskToPush.id
          );
          return remainingTask?.id ?? null;
        }
        return prev;
      });
      setPushSuccess(`Task "${taskToPush.title}" pushed.`);
      setLastPushedTask(taskToPush);
      const reloadSucceeded = await loadActiveTasks();
      if (!reloadSucceeded) {
        setPushError('Task was pushed, but refreshing map data failed.');
      }
    } catch (error) {
      console.error('Error pushing task from map popup:', error);
      setPushSuccess(null);
      setLastPushedTask(null);
      setPushError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Unable to push task.'
      );
    } finally {
      setIsPushingTask(false);
    }
  };
  const nextDispatchableTask = dispatchableTasks.find(
    task => task.id === selectedDispatchTaskId
  );

  useEffect(() => {
    if (!selectedTechnician) {
      return;
    }

    const hasSelected = dispatchableTasks.some(
      task => task.id === selectedDispatchTaskId
    );
    if (!hasSelected) {
      setSelectedDispatchTaskId(dispatchableTasks[0]?.id ?? null);
    }
  }, [dispatchableTasks, selectedDispatchTaskId, selectedTechnician]);

  if (!isMounted) {
    return (
      <div
        className="relative flex items-center justify-center bg-gray-100"
        style={{ height: height || '400px' }}
      >
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{ height: height || '400px' }}
      suppressHydrationWarning
    >
      {isMounted ? (
        <MapGL
          ref={mapRef}
          initialViewState={viewport}
          onLoad={() => setIsMapReady(true)}
          onMove={evt => setViewport(evt.viewState)}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          interactiveLayerIds={['technicians-layer']}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={styles.mapContainer}
        >
          {!isMapReady ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100/90"
              aria-hidden="true"
            >
              <div className="text-gray-500">Loading map...</div>
            </div>
          ) : null}

          {/* Navigation controls */}
          <div className="absolute top-4 right-4 z-10">
            {isMapReady ? <NavigationControl position="top-right" /> : null}
          </div>

          {/* Geolocate control */}
          <div className="absolute top-40 right-4 z-10">
            {isMapReady ? <GeolocateControl position="top-right" /> : null}
          </div>

          {/* Geofence zones for active tasks */}
          {isMapReady
            ? taskGeofences.map(task => (
            <Marker
              anchor="center"
              key={`geofence-${task.id}`}
              latitude={task.latitude}
              longitude={task.longitude}
            >
              <div
                style={styles.geofenceCircle}
                title={`Geofence: ${task.title}`}
              />
            </Marker>
              ))
            : null}

          {/* Technicians markers (clustered by zoom level) */}
          {isMapReady
            ? clusteredPoints.map(cluster => {
            const isCluster = cluster.technicians.length > 1;
            const representative = cluster.technicians[0];

            return (
              <Marker
                anchor="bottom"
                key={cluster.id}
                latitude={cluster.latitude}
                longitude={cluster.longitude}
                onClick={() => handleClusterClick(cluster)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${
                    isCluster
                      ? 'bg-blue-600'
                      : representative.is_online
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                  }`}
                  style={styles.markerShadow}
                >
                  <span className="text-white text-xs font-bold">
                    {isCluster
                      ? cluster.technicians.length
                      : representative.name.charAt(0)}
                  </span>
                </div>
              </Marker>
            );
              })
            : null}

          {/* Popup for selected technician */}
          {isMapReady && selectedTechnician && selectedTechnician.last_location ? (
            <Popup
              anchor="top"
              className="map-popup"
              closeButton
              closeOnClick={false}
              latitude={selectedTechnician.last_location.latitude}
              longitude={selectedTechnician.last_location.longitude}
              onClose={closePopup}
              maxWidth="300px"
            >
              <div className="p-2">
                <h3 className="font-bold text-gray-900">
                  {selectedTechnician.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedTechnician.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      selectedTechnician.is_online
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-xs text-gray-600">
                    {selectedTechnician.is_online ? 'Online' : 'Offline'} -{' '}
                    {formatLastSeen(
                      getLastSeenTimestamp(
                        selectedTechnician.updated_at,
                        selectedTechnician.created_at
                      )
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Active tasks:{' '}
                  {technicianTaskCounts[selectedTechnician.id] || 0}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Unassigned tasks: {dispatchableTasks.length}
                </p>
                {dispatchableTasks.length > 0 ? (
                  <label className="mt-2 block text-xs text-gray-600">
                    Task to push:
                    <select
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                      onChange={event => setSelectedDispatchTaskId(event.target.value)}
                      value={selectedDispatchTaskId ?? ''}
                    >
                      {dispatchableTasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="text-xs text-gray-600 mt-1">
                  Next task:{' '}
                  {nextDispatchableTask ? nextDispatchableTask.title : 'None'}
                </p>
                <button
                  className="mt-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                  disabled={isPushingTask || dispatchableTasks.length === 0}
                  onClick={() => {
                    void handlePushNextTask();
                  }}
                  type="button"
                >
                  {isPushingTask
                    ? 'Pushing...'
                    : `Push selected task (${dispatchableTasks.length})`}
                </button>
                {pushError ? (
                  <p className="mt-1 text-xs text-red-600">{pushError}</p>
                ) : null}
                {pushSuccess ? (
                  <p className="mt-1 text-xs text-green-700">{pushSuccess}</p>
                ) : null}
                {lastPushedTask ? (
                  <Link
                    className="mt-2 inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-black"
                    href={`/dashboard/tasks/${encodeURIComponent(lastPushedTask.id)}`}
                  >
                    Open task
                  </Link>
                ) : null}
              </div>
            </Popup>
          ) : null}
        </MapGL>
      ) : null}
    </div>
  );
}

const styles = {
  mapContainer: {
    width: '100%',
    height: '100%',
  } as React.CSSProperties,
  markerShadow: {
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  } as React.CSSProperties,
  geofenceCircle: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    border: '2px solid rgba(245, 158, 11, 0.8)',
    borderRadius: '9999px',
    height: '60px',
    width: '60px',
    pointerEvents: 'none',
  } as React.CSSProperties,
};
