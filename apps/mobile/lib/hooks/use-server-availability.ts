import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const DEFAULT_API_URL = 'http://localhost:3000';
const HEALTH_PATH = '/api/health';
const CHECK_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 4_000;

export interface ServerAvailabilityState {
  apiBaseUrl: string;
  healthUrl: string;
  isAvailable: boolean | null;
  isChecking: boolean;
  checkedAt: number | null;
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value || DEFAULT_API_URL).replace(/\/+$/, '');
}

export function useServerAvailability(): ServerAvailabilityState {
  const apiBaseUrl = useMemo(
    () => normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL),
    []
  );
  const healthUrl = useMemo(() => `${apiBaseUrl}${HEALTH_PATH}`, [apiBaseUrl]);
  const [state, setState] = useState<ServerAvailabilityState>({
    apiBaseUrl,
    healthUrl,
    isAvailable: null,
    isChecking: true,
    checkedAt: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAvailability = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setState(previous => ({
      ...previous,
      isChecking: true,
    }));

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      setState(previous => ({
        ...previous,
        isAvailable: response.ok,
        isChecking: false,
        checkedAt: Date.now(),
      }));
    } catch {
      setState(previous => ({
        ...previous,
        isAvailable: false,
        isChecking: false,
        checkedAt: Date.now(),
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }, [healthUrl]);

  useEffect(() => {
    checkAvailability();

    intervalRef.current = setInterval(() => {
      checkAvailability();
    }, CHECK_INTERVAL_MS);

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          checkAvailability();
        }
      }
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [checkAvailability]);

  return state;
}
