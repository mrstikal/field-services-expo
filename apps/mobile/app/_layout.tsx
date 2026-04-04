import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { DatabaseProvider } from '@/lib/db/database-provider';
import { OfflineBanner } from '@/components/offline-banner';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity, // Keep data in cache for offline use
      staleTime: 0, // Always consider data potentially stale
      retry: 1,
    },
  },
});

function AppNavigator() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && isAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, isAuthGroup, router]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tasks/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reports/create" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <AuthProvider>
            <AppNavigator />
            <OfflineBanner />
          </AuthProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
