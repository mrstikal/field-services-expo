import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let isInitialized = false;

function getRelease() {
  const config = Constants.expoConfig;
  if (!config?.version) {
    return undefined;
  }

  const runtimeVersion = typeof config.runtimeVersion === 'string' ? config.runtimeVersion : undefined;
  return runtimeVersion ? `${config.version}+${runtimeVersion}` : config.version;
}

export function initSentry() {
  if (isInitialized) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enabled: true,
    debug: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    release: getRelease(),
    environment: __DEV__ ? 'development' : 'production',
  });

  isInitialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!isInitialized) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
}

