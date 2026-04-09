import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamická konfigurace pro EAS Build a OTA Updates
 * Použití: pnpm build --platform android --config app.config.ts
 */

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const easExtra = easProjectId ? { eas: { projectId: easProjectId } } : {};
  const configuredPlugins = (config.plugins || []).filter(plugin => {
    if (typeof plugin === 'string') {
      return ![
        'expo-dev-client',
        'expo-notifications',
        'expo-location',
        'expo-task-manager',
      ].includes(plugin);
    }

    if (Array.isArray(plugin) && typeof plugin[0] === 'string') {
      return ![
        'expo-dev-client',
        'expo-notifications',
        'expo-location',
        'expo-task-manager',
      ].includes(plugin[0]);
    }

    return true;
  });
  const updatesConfig = easProjectId
    ? {
        ...config.updates,
        url: `https://u.expo.dev/${easProjectId}`,
      }
    : config.updates;

  return {
    ...config,
    name: config.name || 'field-service-mobile',
    slug: config.slug || 'field-service-mobile',
    extra: {
      ...config.extra,
      router: {
        origin: false,
      },
      ...easExtra,
      env,
    },
    updates: updatesConfig,
    plugins: [
      ...configuredPlugins,
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
          isIosBackgroundLocationEnabled: true,
          locationWhenInUsePermission:
            'The app needs access to your location to track field technicians.',
          locationAlwaysAndWhenInUsePermission:
            'The app needs access to your location in the background to track field technicians.',
        },
      ],
      'expo-task-manager',
      'expo-dev-client',
      'expo-notifications',
    ],
    android: {
      ...config.android,
      package: 'cz.fieldservice.app',
      permissions: Array.from(
        new Set([
          ...(config.android?.permissions || []),
          'ACCESS_COARSE_LOCATION',
          'ACCESS_FINE_LOCATION',
          'ACCESS_BACKGROUND_LOCATION',
          'FOREGROUND_SERVICE',
          'FOREGROUND_SERVICE_LOCATION',
        ])
      ),
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'cz.fieldservice.app',
    },
  };
};
