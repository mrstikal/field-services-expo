import { describe, expect, it } from 'vitest';
import {
  buildGeofenceRegions,
  type TaskLocation,
} from '../geofencing-regions';

describe('buildGeofenceRegions', () => {
  it('maps tracked tasks to Expo geofencing regions', () => {
    const tasks: TaskLocation[] = [
      {
        id: 'task-1',
        title: 'Replace meter',
        latitude: 50.087,
        longitude: 14.421,
        address: 'Prague',
      },
    ];

    expect(buildGeofenceRegions(tasks)).toEqual([
      {
        identifier: 'task-1',
        latitude: 50.087,
        longitude: 14.421,
        radius: 100,
        notifyOnEnter: true,
        notifyOnExit: false,
      },
    ]);
  });

  it('skips tasks with invalid coordinates', () => {
    const tasks: TaskLocation[] = [
      {
        id: 'task-valid',
        title: 'Valid',
        latitude: 49.2,
        longitude: 16.6,
        address: 'Brno',
      },
      {
        id: 'task-invalid',
        title: 'Invalid',
        latitude: Number.NaN,
        longitude: 16.6,
        address: 'Brno',
      },
    ];

    const regions = buildGeofenceRegions(tasks);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.identifier).toBe('task-valid');
  });
});
