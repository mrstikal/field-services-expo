import { useEffect, useRef } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

function isMissingExpoPushTokenColumnError(
  error: { code?: string; message?: string } | null
) {
  if (!error) {
    return false;
  }

  return (
    error.code === '42703' ||
    (error.code === 'PGRST204' && error.message?.includes('expo_push_token')) ===
      true
  );
}

function isUnsupportedExpoGoPushEnvironment() {
  return (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

let notificationsConfigured = false;

async function loadNotificationsModule() {
  const Notifications = await import('expo-notifications');

  if (!notificationsConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    notificationsConfigured = true;
  }

  return Notifications;
}

export function usePushTokenRegistration(userId: string | undefined) {
  const lastRegisteredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (isUnsupportedExpoGoPushEnvironment()) {
          console.info(
            'Skipping push token registration because Android remote notifications are not available in Expo Go.'
          );
          return;
        }

        const Notifications = await loadNotificationsModule();
        const existingPermission = await Notifications.getPermissionsAsync();
        let finalStatus = existingPermission.status;

        if (finalStatus !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }

        if (finalStatus !== 'granted') {
          return;
        }

        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (!projectId) {
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const token = tokenResponse.data;

        if (
          cancelled ||
          !token ||
          lastRegisteredTokenRef.current === token
        ) {
          return;
        }

        const { error } = await supabase
          .from('users')
          .update({ expo_push_token: token })
          .eq('id', userId);

        if (error) {
          if (!isMissingExpoPushTokenColumnError(error)) {
            console.warn('Failed to store expo push token:', error);
          }
          return;
        }

        lastRegisteredTokenRef.current = token;
      } catch (error) {
        console.warn('Push token registration failed:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
