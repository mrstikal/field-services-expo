import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ActivityIndicator } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { OfflineBanner } from '@/components/offline-banner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushTokenRegistration } from '@/lib/hooks/use-push-token-registration';
import type { ComponentProps } from 'react';
import { getDatabase } from '@/lib/db/local-database';
import { getTotalUnreadCount } from '@/lib/db/conversation-repository';
import { subscribeToSyncEvents } from '@/lib/sync/sync-events';

type TabScreenOptions = NonNullable<
  ComponentProps<typeof Tabs.Screen>['options']
>;

function createTabOptions(
  title: string,
  testID: string,
  iconName: ComponentProps<typeof Ionicons>['name']
): TabScreenOptions {
  return {
    title,
    headerShown: false,
    tabBarButtonTestID: testID,
    tabBarIcon: ({ color, size }) => (
      <Ionicons color={color} name={iconName} size={size} />
    ),
  };
}

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const bannerReservedHeight = insets.top + 10;
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  usePushTokenRegistration(user?.id);

  const loadChatUnreadCount = useCallback(async () => {
    if (!user) {
      setChatUnreadCount(0);
      return;
    }

    try {
      const db = getDatabase();
      const unreadCount = await getTotalUnreadCount(db, user.id);
      setChatUnreadCount(unreadCount);
    } catch (error) {
      console.error('Error loading chat unread count:', error);
      setChatUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadChatUnreadCount();
    const unsubscribe = subscribeToSyncEvents(() => {
      void loadChatUnreadCount();
    });

    return unsubscribe;
  }, [loadChatUnreadCount, user]);

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

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View pointerEvents="none" style={{ height: bannerReservedHeight }} />
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
          options={createTabOptions('Home', 'tab-home', 'home-outline')}
        />
        <Tabs.Screen
          name="tasks/index"
          options={createTabOptions('Tasks', 'tab-tasks', 'list-outline')}
        />
        <Tabs.Screen
          name="reports/index"
          options={createTabOptions(
            'Reports',
            'tab-reports',
            'document-text-outline'
          )}
        />
        <Tabs.Screen
          name="chat/index"
          options={{
            ...createTabOptions('Chat', 'tab-chat', 'chatbubble-outline'),
            tabBarBadge: chatUnreadCount > 0 ? (chatUnreadCount > 99 ? '99+' : chatUnreadCount) : undefined,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={createTabOptions('Profile', 'tab-profile', 'person-outline')}
        />
        {/* Hide scanner, nested report and chat screens from tab bar */}
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
        <Tabs.Screen
          name="chat/new"
          options={{
            href: null,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="chat/[id]"
          options={{
            href: null,
            headerShown: false,
          }}
        />
      </Tabs>
    </View>
  );
}
