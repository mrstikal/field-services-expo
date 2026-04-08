import { Redirect, Stack } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
          paddingHorizontal: 24,
        }}
      >
        <ActivityIndicator color="#1e40af" size="large" />
        <Text style={{ marginTop: 16, fontSize: 14, color: '#6b7280' }}>
          Loading app...
        </Text>
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
