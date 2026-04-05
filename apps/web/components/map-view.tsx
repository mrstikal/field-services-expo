'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import MapGL, { Marker, Popup, NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';


interface Technician {
  id: string;
  name: string;
  email: string;
  is_online: boolean;
  last_location: {
    latitude: number;
    longitude: number;
  } | null;
  created_at: string;
}

interface MapViewProps {
  readonly height?: string;
}

interface TaskGeofence {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  status: string;
}

interface ClusterPoint {
  id: string;
  latitude: number;
  longitude: number;
  technicians: Technician[];
}

 
export default function MapView({ height }: MapViewProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [technicianTaskCounts, setTechnicianTaskCounts] = useState<Record<string, number>>({});
  const [taskGeofences, setTaskGeofences] = useState<TaskGeofence[]>([]);
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
    setIsMapReady(true);
  }, []);

  const clusterPrecision = viewport.zoom < 7 ? 1 : viewport.zoom < 9 ? 2 : 3;
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

  // Load technicians with locations
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        const [usersResult, tasksResult] = await Promise.all([
          supabase
            .from('users')
            .select('*')
            .eq('role', 'technician'),
          supabase
            .from('tasks')
            .select('id, title, latitude, longitude, status, technician_id')
            .in('status', ['assigned', 'in_progress']),
        ]);

        const { data, error } = usersResult;
        if (error) {
          if (error.message === 'Invalid API key') {
            console.error('Supabase API key is invalid. Please check NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
          } else {
            console.error('Error loading technicians:', error);
          }
          return;
        }

        if (tasksResult.error) {
          console.error('Error loading task geofences:', tasksResult.error);
          return;
        }

        if (tasksResult.data) {
          const counts = tasksResult.data.reduce<Record<string, number>>((acc, task) => {
            const technicianId = typeof task.technician_id === 'string' ? task.technician_id : null;
            if (technicianId) {
              acc[technicianId] = (acc[technicianId] || 0) + 1;
            }
            return acc;
          }, {});
          setTechnicianTaskCounts(counts);

          const geofences = tasksResult.data.filter(task =>
            typeof task.latitude === 'number' && typeof task.longitude === 'number'
          ) as TaskGeofence[];
          setTaskGeofences(geofences);
        }

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
          filter: "role=eq=technician",
        },
        (payload) => {
          setTechnicians(prev =>
            prev.map(tech =>
              tech.id === payload.new.id ? (payload.new as Technician) : tech
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle marker click
  const handleMarkerClick = (technician: Technician) => {
    setSelectedTechnician(technician);
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
  };

  // Format last seen time
  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!isMapReady) {
    return (
      <div className="relative flex items-center justify-center bg-gray-100" style={{ height: height || '400px' }}>
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }


  if (viewport.latitude === 0 && viewport.longitude === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: height || '400px' }}>
        <div className="text-gray-500">Initializing map...</div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: height || '400px' }} suppressHydrationWarning>
      {isMounted && isMapReady ? (
        <MapGL
          ref={mapRef}
          initialViewState={viewport}
          onMove={evt => setViewport(evt.viewState)}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          interactiveLayerIds={['technicians-layer']}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={styles.mapContainer}
        >
        {/* Navigation controls */}
        <div className="absolute top-4 right-4 z-10">
          <NavigationControl position="top-right" />
        </div>

        {/* Geolocate control */}
        <div className="absolute top-40 right-4 z-10">
          <GeolocateControl position="top-right" />
        </div>

        {/* Geofence zones for active tasks */}
        {taskGeofences.map(task => (
          <Marker
            anchor="center"
            key={`geofence-${task.id}`}
            latitude={task.latitude}
            longitude={task.longitude}
          >
            <div style={styles.geofenceCircle} title={`Geofence: ${task.title}`} />
          </Marker>
        ))}

        {/* Technicians markers (clustered by zoom level) */}
        {clusteredPoints.map(cluster => {
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
                  {isCluster ? cluster.technicians.length : representative.name.charAt(0)}
                </span>
              </div>
            </Marker>
          );
        })}

        {/* Popup for selected technician */}
        {selectedTechnician ? <Popup
            anchor="top"
            className="map-popup"
            closeButton
            closeOnClick={false}
            latitude={selectedTechnician.last_location?.latitude || 0}
            longitude={selectedTechnician.last_location?.longitude || 0}
            onClose={closePopup}
            maxWidth="300px"
          >
            <div className="p-2">
              <h3 className="font-bold text-gray-900">{selectedTechnician.name}</h3>
              <p className="text-sm text-gray-600">{selectedTechnician.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    selectedTechnician.is_online ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-gray-600">
                  {selectedTechnician.is_online ? 'Online' : 'Offline'} - {formatLastSeen(selectedTechnician.created_at)}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Active tasks: {technicianTaskCounts[selectedTechnician.id] || 0}
              </p>
            </div>
          </Popup> : null}
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
