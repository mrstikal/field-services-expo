import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

// Geofence radius in meters
const GEOFENCE_RADIUS = 100;

interface TaskLocation {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
}

interface UseGeofencingReturn {
  currentLocation: Location.LocationObject | null;
  nearbyTasks: TaskLocation[];
  trackedTasks: TaskLocation[];
  isNearTask: boolean;
  currentTask: TaskLocation | null;
  updateLocation: (location: Location.LocationObject) => void;
  setTrackedTasks: (tasks: TaskLocation[]) => void;
  checkGeofence: (tasks?: TaskLocation[]) => Promise<void>;
  distanceToTask: (task: TaskLocation) => number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Custom hook for geofencing functionality
 * Automatically checks if user is near a task location
 */
export function useGeofencing(): UseGeofencingReturn {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [nearbyTasks, setNearbyTasks] = useState<TaskLocation[]>([]);
  const [trackedTasks, setTrackedTasks] = useState<TaskLocation[]>([]);
  const [isNearTask, setIsNearTask] = useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<TaskLocation | null>(null);

  // Debounce timer reference
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update current location - kept for potential future use
  const updateLocation = useCallback((location: Location.LocationObject) => {
    setCurrentLocation(location);
  }, []);

  const handleSetTrackedTasks = useCallback((tasks: TaskLocation[]) => {
    setTrackedTasks(tasks);
  }, []);

  // Check geofence around tasks
  const checkGeofence = useCallback(async (tasks?: TaskLocation[]) => {
    if (!currentLocation) {
      return;
    }

    const tasksToCheck = tasks ?? trackedTasks;
    if (!tasksToCheck.length) {
      setNearbyTasks([]);
      setCurrentTask(null);
      setIsNearTask(false);
      return;
    }

    const nearby: TaskLocation[] = [];
    let nearestTask: TaskLocation | null = null;
    let nearestDistance = Infinity;

    for (const task of tasksToCheck) {
      const distance = calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        task.latitude,
        task.longitude
      );

      if (distance <= GEOFENCE_RADIUS) {
        nearby.push(task);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestTask = task;
        }
      }
    }

    setNearbyTasks(nearby);
    setCurrentTask(nearestTask);
    setIsNearTask(nearby.length > 0);

    // Alert when entering geofence
    if (nearby.length > 0 && !isNearTask) {
      Alert.alert(
        'Arrived at Task',
        `You have arrived at: ${nearestTask?.title}\nAddress: ${nearestTask?.address}`,
        [
          {
            text: 'Check In',
            onPress: () => {
              console.log('Task checked in:', nearestTask?.id);
              // Here you would call your API to update task status
            },
          },
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => {
              setIsNearTask(false);
            },
          },
        ]
      );
    }
  }, [currentLocation, isNearTask, trackedTasks]);

  // Debounced geofence check (to avoid too many alerts)
  useEffect(() => {
    if (!currentLocation) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      checkGeofence();
    }, 5000); // Check every 5 seconds

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentLocation, checkGeofence]);

  // Calculate distance to a specific task
  const distanceToTask = useCallback((task: TaskLocation): number => {
    if (!currentLocation) {
      return Infinity;
    }

    return calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      task.latitude,
      task.longitude
    );
  }, [currentLocation]);

  return {
    currentLocation,
    nearbyTasks,
    trackedTasks,
    isNearTask,
    currentTask,
    updateLocation,
    setTrackedTasks: handleSetTrackedTasks,
    checkGeofence,
    distanceToTask,
  };
}

export default useGeofencing;