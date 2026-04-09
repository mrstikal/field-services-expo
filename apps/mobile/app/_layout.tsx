import '@/global.css';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/lib/auth-context';
import { View } from 'react-native';
import { useEffect } from 'react';
import { DatabaseProvider } from '@/lib/db/database-provider';
import { ServerUnavailableBanner } from '@/components/server-unavailable-banner';
import { initSentry } from '@/lib/monitoring/sentry';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <DatabaseProvider>
            <AuthProvider>
              <View style={{ flex: 1, position: 'relative' }}>
                <ServerUnavailableBanner />
                <View style={{ flex: 1 }}>
                  <Slot />
                </View>
              </View>
            </AuthProvider>
          </DatabaseProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
