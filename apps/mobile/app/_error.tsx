import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ErrorBoundary() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 p-6">
      <View className="mb-6">
        <Ionicons color="#ef4444" name="alert-circle-outline" size={64} />
      </View>
      <Text className="mb-2 text-2xl font-bold text-gray-800">Something went wrong</Text>
      <Text className="mb-8 text-center text-base text-gray-500">We apologize, but an unexpected error occurred</Text>
      <Button onPress={() => router.push('/')} title="Back to home" />
    </View>
  );
}

