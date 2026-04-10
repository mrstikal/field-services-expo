import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamická konfigurace pro EAS Build a OTA Updates
 * Použití: pnpm build --platform android --config app.config.ts
 */

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  const easProjectIdFromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const easProjectIdFromConfig =
    typeof config.extra?.eas?.projectId === 'string' ? config.extra.eas.projectId : undefined;
  const resolveProjectId = [easProjectIdFromEnv, easProjectIdFromConfig].find(
    projectId => projectId && !projectId.includes('YOUR_EAS_PROJECT_ID')
  );
  const shouldUseEasUpdates = env === 'production' && Boolean(resolveProjectId);
  const easExtra = shouldUseEasUpdates && resolveProjectId ? { eas: { projectId: resolveProjectId } } : {};
  const { eas: _ignoredEasExtra, ...extraWithoutEas } = config.extra ?? {};
  const configuredPlugins = (config.plugins || []).filter(plugin => {
    if (typeof plugin === 'string') {
      return ![
        'expo-dev-client',
        'expo-location',
        'expo-task-manager',
      ].includes(plugin);
    }

    if (Array.isArray(plugin) && typeof plugin[0] === 'string') {
      return ![
        'expo-dev-client',
        'expo-location',
        'expo-task-manager',
      ].includes(plugin[0]);
    }

    return true;
  });
  const updatesConfig = shouldUseEasUpdates && resolveProjectId
    ? {
        ...config.updates,
        url: `https://u.expo.dev/${resolveProjectId}`,
      }
    : undefined;

  return {
    ...config,
    name: config.name || 'field-service-mobile',
    slug: config.slug || 'field-service-mobile',
    extra: {
      ...extraWithoutEas,
      router: {
        origin: false,
      },
      ...easExtra,
      env,
    },
    updates: updatesConfig,
    runtimeVersion: shouldUseEasUpdates
      ? config.runtimeVersion ?? {
          policy: 'appVersion',
        }
      : undefined,
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
