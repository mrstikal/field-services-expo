import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-slate-100 p-5">
      <Text className="mb-4 text-2xl font-bold text-red-500">404 - Page Not Found</Text>
      <Text className="mb-6 text-center text-base text-gray-500">Sorry, the page you requested does not exist.</Text>
      <Button onPress={() => router.replace('/')} title="Back to Home" />
    </View>
  );
}

