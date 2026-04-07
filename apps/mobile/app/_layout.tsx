import '../global.css';
import { Slot } from 'expo-router';
import { View, Text } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/lib/auth-context';
import { DatabaseProvider } from '@/lib/db/database-provider';
import { OfflineBanner } from '@/components/offline-banner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity, // Keep data in cache for offline use
      staleTime: 0, // Always consider data potentially stale
      retry: 1,
    },
  },
});

export default function RootLayout() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV,
    enableNativeCrashHandling: true,
  });

  return (
    <Sentry.ErrorBoundary fallback={<View className="flex-1 items-center justify-center bg-slate-50 p-6"><Text className="text-center text-gray-800">An error occurred</Text></View>}>
      <GestureHandlerRootView className="flex-1">
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <DatabaseProvider>
              <AuthProvider>
                <Slot />
                <OfflineBanner />
              </AuthProvider>
            </DatabaseProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </Sentry.ErrorBoundary>
  );
}
