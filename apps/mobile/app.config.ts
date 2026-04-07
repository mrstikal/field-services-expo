import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamická konfigurace pro EAS Build a OTA Updates
 * Použití: pnpm build --platform android --config app.config.ts
 */

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID';

  return {
    ...config,
    name: config.name || 'field-service-mobile',
    slug: config.slug || 'field-service-mobile',
    extra: {
      ...config.extra,
      router: {
        origin: false,
      },
      eas: {
        projectId: easProjectId,
      },
      env,
    },
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${easProjectId}`,
    },
    android: {
      ...config.android,
      package: 'cz.fieldservice.app',
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'cz.fieldservice.app',
    },
  };
};