import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export function usePushTokenRegistration(userId: string | undefined) {
  const lastRegisteredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
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
