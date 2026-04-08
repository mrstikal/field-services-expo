import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { OfflineBanner } from '@/components/offline-banner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

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
        <Text style={{ marginTop: 16, fontSize: 14, color: '#6b7280' }}>Loading app...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1e40af',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#e5e7eb',
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons color={color} name="home-outline" size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks/index"
          options={{
            title: 'Tasks',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons color={color} name="list-outline" size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports/index"
          options={{
            title: 'Reports',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons color={color} name="document-text-outline" size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons color={color} name="person-outline" size={size} />
            ),
          }}
        />
        {/* Hide scanner and nested report screens from tab bar */}
        <Tabs.Screen
          name="scanner"
          options={{
            href: null,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="reports/create"
          options={{
            href: null,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="reports/[id]"
          options={{
            href: null,
            headerShown: false,
          }}
        />
      </Tabs>
    </View>
  );
}
