import { Redirect, Stack } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-100">
        <ActivityIndicator color="#1e40af" size="large" />
        <Text className="mt-4 text-sm text-gray-500">Loading app...</Text>
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
