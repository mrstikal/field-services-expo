import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="items-center border-b border-gray-200 bg-white px-4 py-6" style={{ paddingTop: insets.top + 24 }}>
        <View className="mb-4">
          <Ionicons color="#1e40af" name="person-circle" size={80} />
        </View>
        <Text className="mb-1 text-xl font-semibold text-gray-800">{user?.profile.name || 'Technician'}</Text>
        <Text className="text-sm text-gray-500">{user?.email}</Text>
      </View>

      <View className="px-4 py-4">
        <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-800">Contact Information</Text>
        <View className="mb-2 rounded-lg border border-gray-200 bg-white p-3">
          <View className="flex-row items-center">
            <Ionicons color="#6b7280" name="mail-outline" size={20} />
            <View className="ml-3 flex-1">
              <Text className="mb-0.5 text-xs text-gray-500">Email</Text>
              <Text className="text-sm font-medium text-gray-800">{user?.email}</Text>
            </View>
          </View>
        </View>

        <View className="mb-2 rounded-lg border border-gray-200 bg-white p-3">
          <View className="flex-row items-center">
            <Ionicons color="#6b7280" name="call-outline" size={20} />
            <View className="ml-3 flex-1">
              <Text className="mb-0.5 text-xs text-gray-500">Phone</Text>
              <Text className="text-sm font-medium text-gray-800">{user?.profile.phone || 'Not set'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-800">Account</Text>
        <View className="mb-2 rounded-lg border border-gray-200 bg-white p-3">
          <View className="flex-row items-center">
            <Ionicons color="#6b7280" name="shield-checkmark-outline" size={20} />
            <View className="ml-3 flex-1">
              <Text className="mb-0.5 text-xs text-gray-500">Role</Text>
              <Text className="text-sm font-medium text-gray-800">{user?.role === 'technician' ? 'Technician' : 'Dispatcher'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="px-4 py-4">
        <TouchableOpacity className="flex-row items-center justify-center rounded-lg border border-red-100 bg-red-50 p-3" onPress={handleSignOut}>
          <Ionicons color="#ef4444" name="log-out-outline" size={20} />
          <Text className="ml-2 text-sm font-semibold text-red-500">Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View className="items-center py-6">
        <Text className="text-xs text-gray-400">Field Service v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

