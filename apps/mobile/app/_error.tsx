import { View, Text, TouchableOpacity, ScrollView, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { captureException } from '@/lib/monitoring/sentry';

const errorContainerStyle: ViewStyle = {
  flexGrow: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    if (error) {
      captureException(error, { source: 'expo-router-error-boundary' });
    }
  }, [error]);

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={errorContainerStyle}
    >
      <View className="mb-6">
        <Ionicons color="#ef4444" name="alert-circle-outline" size={64} />
      </View>

      <Text className="mb-2 text-2xl font-bold text-gray-800">Something went wrong</Text>
      <Text className="mb-4 text-center text-base text-gray-500">
        We apologize, but an unexpected error occurred.
      </Text>

      {error?.message ? (
        <View className="mb-8 w-full rounded-lg bg-red-50 p-4">
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
            Error details
          </Text>
          <Text className="font-mono text-xs text-red-700">{error.message}</Text>
        </View>
      ) : null}

      <View className="w-full gap-3">
        <TouchableOpacity
          className="w-full items-center rounded-lg bg-blue-800 px-6 py-3"
          onPress={retry}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons color="#ffffff" name="refresh-outline" size={18} />
            <Text className="text-base font-semibold text-white">Try again</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full items-center rounded-lg border border-gray-300 bg-white px-6 py-3"
          onPress={() => router.replace('/')}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons color="#374151" name="home-outline" size={18} />
            <Text className="text-base font-semibold text-gray-700">Back to home</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default ErrorBoundary;
