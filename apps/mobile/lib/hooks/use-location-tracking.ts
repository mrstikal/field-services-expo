import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';
import { initDatabase } from '@/lib/db/local-database';
import { locationRepository } from '@/lib/db/location-repository';
import { supabase } from '@/lib/supabase';
import { getCachedActiveUserSession } from '@/lib/auth-session-cache';
import { shouldPersistLocation } from './location-tracking.utils';

const LOCATION_TASK_NAME = 'background-location-task';
let dbInitPromise: ReturnType<typeof initDatabase> | null = null;
const lastPersistAtByTechnician = new Map<string, number>();

async function ensureDatabaseInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase();
  }
  await dbInitPromise;
}

interface LocationUpdate {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number;
    heading?: number;
  };
  timestamp: number;
}

async function resolveTrackedTechnicianId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id) {
    return user.id;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    return session.user.id;
  }

  const cachedSession = await getCachedActiveUserSession();
  if (cachedSession?.id && cachedSession.role === 'technician') {
    return cachedSession.id;
  }

  return null;
}

async function persistLocationUpdate(update: LocationUpdate) {
  await ensureDatabaseInitialized();
  const technicianId = await resolveTrackedTechnicianId();

  if (!technicianId) {
    console.warn(
      'Skipping location persistence because no tracked technician id is available.'
    );
    return;
  }

  const currentTimestamp = update.timestamp || Date.now();
  const lastPersistTimestamp = lastPersistAtByTechnician.get(technicianId);
  if (!shouldPersistLocation(lastPersistTimestamp, currentTimestamp)) {
    return;
  }

  await locationRepository.saveDeviceLocation({
    technician_id: technicianId,
    latitude: update.coords.latitude,
    longitude: update.coords.longitude,
    accuracy: update.coords.accuracy ?? 0,
    timestamp: new Date(update.timestamp).toISOString(),
  });
  lastPersistAtByTechnician.set(technicianId, currentTimestamp);
}

function registerLocationTask() {
  if (TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
    return;
  }

  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error || !data) {
      if (error) {
        console.error('Location task error:', error);
      }
      return;
    }

    const { locations } = data as { locations: LocationUpdate[] };
    await Promise.all(
      locations.map(location => persistLocationUpdate(location))
    );
  });
}

registerLocationTask();

interface UseLocationTrackingReturn {
  hasPermission: boolean;
  location: Location.LocationObject | null;
  lastLocation: Location.LocationObject | null;
  isTracking: boolean;
  isBackgroundTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  startBackgroundTracking: () => Promise<void>;
  stopBackgroundTracking: () => Promise<void>;
  checkPermissions: () => Promise<boolean>;
  requestPermissions: () => Promise<Location.LocationPermissionResponse>;
}

export function useLocationTracking(): UseLocationTrackingReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [lastLocation, setLastLocation] =
    useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );

  const checkPermissions = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  }, []);

  const requestPermissions =
    useCallback(async (): Promise<Location.LocationPermissionResponse> => {
      const response = await Location.requestForegroundPermissionsAsync();
      if (response.status === 'granted') {
        setHasPermission(true);
      }
      return response;
    }, []);

  const requestBackgroundPermissions =
    useCallback(async (): Promise<Location.LocationPermissionResponse> => {
      const response = await Location.requestBackgroundPermissionsAsync();
      if (response.status === 'granted') {
        setHasPermission(true);
      }
      return response;
    }, []);

  const startTracking = useCallback(async () => {
    if (!hasPermission) {
      const granted = await checkPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant location permission');
        return;
      }
    }

    try {
      setIsTracking(true);
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        async newLocation => {
          setLocation(newLocation);
          setLastLocation(newLocation);
          await persistLocationUpdate({
            coords: {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy ?? 0,
              speed: newLocation.coords.speed ?? undefined,
              heading: newLocation.coords.heading ?? undefined,
            },
            timestamp: newLocation.timestamp,
          });
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsTracking(false);
    }
  }, [hasPermission, checkPermissions]);

  const stopTracking = useCallback(async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startBackgroundTracking = useCallback(async () => {
    const isTaskManagerAvailable = await TaskManager.isAvailableAsync();
    if (!isTaskManagerAvailable) {
      console.info(
        'Skipping background location tracking because TaskManager is not available in this build.'
      );
      setIsBackgroundTracking(false);
      return;
    }

    if (!hasPermission) {
      const granted = await checkPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant location permission');
        return;
      }
    }

    const bgResponse = await requestBackgroundPermissions();
    if (bgResponse.status !== 'granted') {
      console.info(
        'Background location permission was not granted. Continuing with foreground tracking only.'
      );
      setIsBackgroundTracking(false);
      return;
    }

    try {
      const alreadyStarted =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!alreadyStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'Location Tracking',
            notificationBody: 'Tracking your location in the background',
          },
        });
      }
      setIsBackgroundTracking(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Unknown error');

      if (
        message.includes('hasStartedLocationUpdatesAsync') ||
        message.includes('startLocationUpdatesAsync') ||
        message.includes('not available') ||
        message.includes('unavailable')
      ) {
        console.warn(
          'Skipping background location tracking because it is not available in the current Android build.'
        );
        setIsBackgroundTracking(false);
        return;
      }

      console.error('Error starting background tracking:', error);
      setIsBackgroundTracking(false);
    }
  }, [hasPermission, checkPermissions, requestBackgroundPermissions]);

  const stopBackgroundTracking = useCallback(async () => {
    try {
      const alreadyStarted =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (alreadyStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      setIsBackgroundTracking(false);
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      .then(setIsBackgroundTracking)
      .catch(() => setIsBackgroundTracking(false));
  }, [checkPermissions]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    hasPermission,
    location,
    lastLocation,
    isTracking,
    isBackgroundTracking,
    startTracking,
    stopTracking,
    startBackgroundTracking,
    stopBackgroundTracking,
    checkPermissions,
    requestPermissions,
  };
}

export default useLocationTracking;
