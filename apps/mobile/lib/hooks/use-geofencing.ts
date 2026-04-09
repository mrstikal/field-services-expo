import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';
import { taskRepository } from '@/lib/db/task-repository';
import {
  buildGeofenceRegions,
  GEOFENCE_RADIUS,
  type TaskLocation,
} from './geofencing-regions';
const GEOFENCE_TASK_NAME = 'task-geofencing-task';

interface UseGeofencingReturn {
  currentLocation: Location.LocationObject | null;
  nearbyTasks: TaskLocation[];
  trackedTasks: TaskLocation[];
  isNativeGeofencing: boolean;
  isNearTask: boolean;
  currentTask: TaskLocation | null;
  updateLocation: (location: Location.LocationObject) => void;
  setTrackedTasks: (tasks: TaskLocation[]) => void;
  checkGeofence: (tasks?: TaskLocation[]) => Promise<void>;
  distanceToTask: (task: TaskLocation) => number;
}

interface GeofencingTaskData {
  eventType: Location.LocationGeofencingEventType;
  region: Location.LocationRegion;
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
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function registerGeofencingTask() {
  if (TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
    return;
  }

  TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error || !data) {
      if (error) {
        console.error('Geofencing task error:', error);
      }
      return;
    }

    const geofencingEvent = data as GeofencingTaskData;

    if (
      geofencingEvent.eventType === Location.GeofencingEventType.Enter &&
      geofencingEvent.region?.identifier
    ) {
      await taskRepository.updateStatus(
        geofencingEvent.region.identifier,
        'in_progress'
      );
    }
  });
}

registerGeofencingTask();

/**
 * Custom hook for geofencing functionality
 * Automatically checks if user is near a task location
 */
export function useGeofencing(): UseGeofencingReturn {
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [nearbyTasks, setNearbyTasks] = useState<TaskLocation[]>([]);
  const [trackedTasks, setTrackedTasks] = useState<TaskLocation[]>([]);
  const [isNativeGeofencing, setIsNativeGeofencing] = useState(false);
  const [isNearTask, setIsNearTask] = useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<TaskLocation | null>(null);

  // Debounce timer reference
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedTasksRef = useRef<TaskLocation[]>([]);
  const isNearTaskRef = useRef(false);

  useEffect(() => {
    isNearTaskRef.current = isNearTask;
  }, [isNearTask]);

  // Update current location - kept for potential future use
  const updateLocation = useCallback((location: Location.LocationObject) => {
    setCurrentLocation(location);
  }, []);

  const updateNativeGeofencing = useCallback(async (tasks: TaskLocation[]) => {
    try {
      const started = await Location.hasStartedGeofencingAsync(
        GEOFENCE_TASK_NAME
      );
      const regions = buildGeofenceRegions(tasks);

      if (!regions.length) {
        if (started) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
        setIsNativeGeofencing(false);
        return;
      }

      const fgPermissions = await Location.getForegroundPermissionsAsync();
      if (fgPermissions.status !== 'granted') {
        const fgRequest = await Location.requestForegroundPermissionsAsync();
        if (fgRequest.status !== 'granted') {
          setIsNativeGeofencing(false);
          return;
        }
      }

      const bgPermissions = await Location.getBackgroundPermissionsAsync();
      if (bgPermissions.status !== 'granted') {
        const bgRequest = await Location.requestBackgroundPermissionsAsync();
        if (bgRequest.status !== 'granted') {
          setIsNativeGeofencing(false);
          return;
        }
      }

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
      setIsNativeGeofencing(true);
    } catch (error) {
      console.error('Native geofencing setup failed:', error);
      setIsNativeGeofencing(false);
    }
  }, []);

  const handleSetTrackedTasks = useCallback((tasks: TaskLocation[]) => {
    trackedTasksRef.current = tasks;
    setTrackedTasks(prev => {
      if (
        prev.length === tasks.length &&
        prev.every((task, index) => task.id === tasks[index]?.id)
      ) {
        return prev;
      }
      return tasks;
    });
    void updateNativeGeofencing(tasks);
  }, [updateNativeGeofencing]);

  const handleCheckIn = useCallback(async (taskId: string) => {
    try {
      const updated = await taskRepository.updateStatus(taskId, 'in_progress');
      if (!updated) {
        Alert.alert('Check In Failed', 'Unable to start the task.');
        return;
      }

      Alert.alert('Checked In', 'Task status was updated to In Progress.');
    } catch {
      Alert.alert('Check In Failed', 'Unable to start the task.');
    }
  }, []);

  // Check geofence around tasks
  const checkGeofence = useCallback(
    async (tasks?: TaskLocation[]) => {
      if (!currentLocation) {
        return;
      }

      const tasksToCheck = tasks ?? trackedTasksRef.current;
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
      if (nearby.length > 0 && !isNearTaskRef.current) {
        Alert.alert(
          'Arrived at Task',
          `You have arrived at: ${nearestTask?.title}\nAddress: ${nearestTask?.address}`,
          [
            {
              text: 'Check In',
              onPress: () => {
                if (!nearestTask?.id) {
                  return;
                }
                void handleCheckIn(nearestTask.id);
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
    },
    [currentLocation, handleCheckIn]
  );

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
  const distanceToTask = useCallback(
    (task: TaskLocation): number => {
      if (!currentLocation) {
        return Infinity;
      }

      return calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        task.latitude,
        task.longitude
      );
    },
    [currentLocation]
  );

  return {
    currentLocation,
    nearbyTasks,
    trackedTasks,
    isNativeGeofencing,
    isNearTask,
    currentTask,
    updateLocation,
    setTrackedTasks: handleSetTrackedTasks,
    checkGeofence,
    distanceToTask,
  };
}

export default useGeofencing;
