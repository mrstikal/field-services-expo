import * as Location from 'expo-location';

export const GEOFENCE_RADIUS = 100;

export interface TaskLocation {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
}

export function buildGeofenceRegions(
  tasks: TaskLocation[]
): Location.LocationRegion[] {
  return tasks
    .filter(
      task => Number.isFinite(task.latitude) && Number.isFinite(task.longitude)
    )
    .map(task => ({
      identifier: task.id,
      latitude: task.latitude,
      longitude: task.longitude,
      radius: GEOFENCE_RADIUS,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));
}
