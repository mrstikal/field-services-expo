import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

// Task name for background location tracking
const LOCATION_TASK_NAME = 'background-location-task';

function registerLocationTask() {
  if (TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
    return;
  }

  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Location task error:', error);
      return;
    }
    if (data) {
      const { locations } = data as { locations: LocationUpdate[] };
      // TODO: Persist/send to sync queue when backend contract is finalized.
      console.log('Background location update:', locations);
    }
  });
}

// Define location update callback type
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

// Register background task once at module load.
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

/**
 * Custom hook for location tracking functionality
 * Handles foreground and background location tracking
 */
export function useLocationTracking(): UseLocationTrackingReturn {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [isBackgroundTracking, setIsBackgroundTracking] = useState<boolean>(false);

  // Location subscription reference
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Check permissions
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<Location.LocationPermissionResponse> => {
    const response = await Location.requestForegroundPermissionsAsync();
    if (response.status === 'granted') {
      setHasPermission(true);
    }
    return response;
  }, []);

  // Request background permissions
  const requestBackgroundPermissions = useCallback(async (): Promise<Location.LocationPermissionResponse> => {
    const response = await Location.requestBackgroundPermissionsAsync();
    if (response.status === 'granted') {
      setHasPermission(true);
    }
    return response;
  }, []);

  // Start foreground tracking
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
          timeInterval: 1000, // 1 second
          distanceInterval: 1, // 1 meter
        },
        (newLocation: Location.LocationObject) => {
          setLocation(newLocation);
          setLastLocation(newLocation);
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsTracking(false);
    }
  }, [hasPermission, checkPermissions]);

  // Stop foreground tracking
  const stopTracking = useCallback(async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Start background tracking
  const startBackgroundTracking = useCallback(async () => {
    if (!hasPermission) {
      const granted = await checkPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant location permission');
        return;
      }
    }

    // Request background permissions
    const bgResponse = await requestBackgroundPermissions();
    if (bgResponse.status !== 'granted') {
      Alert.alert('Background Permission Required', 'Background location permission is required for tracking');
      return;
    }

    try {
      const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (alreadyStarted) {
        setIsBackgroundTracking(true);
        return;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // 10 meters
        foregroundService: {
          notificationTitle: 'Location Tracking',
          notificationBody: 'Tracking your location in the background',
        },
      });
      setIsBackgroundTracking(true);
    } catch (error) {
      console.error('Error starting background tracking:', error);
    }
  }, [hasPermission, checkPermissions, requestBackgroundPermissions]);

  // Stop background tracking
  const stopBackgroundTracking = useCallback(async () => {
    try {
      const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!alreadyStarted) {
        setIsBackgroundTracking(false);
        return;
      }

      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsBackgroundTracking(false);
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTracking();
      stopBackgroundTracking();
    };
  }, [stopTracking, stopBackgroundTracking]);

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