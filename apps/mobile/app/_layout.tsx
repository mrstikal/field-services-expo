import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="tasks/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="reports/create" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
