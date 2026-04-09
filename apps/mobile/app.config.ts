import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamická konfigurace pro EAS Build a OTA Updates
 * Použití: pnpm build --platform android --config app.config.ts
 */

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const easExtra = easProjectId ? { eas: { projectId: easProjectId } } : {};
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
    plugins: Array.from(new Set([...(config.plugins || []), 'expo-notifications'])),
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
