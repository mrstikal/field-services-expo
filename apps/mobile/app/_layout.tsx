import '../global.css';
import { Slot } from 'expo-router';
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
  return (
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
  );
}
