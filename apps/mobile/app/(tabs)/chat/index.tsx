import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { getDatabase } from '@/lib/db/local-database';
import {
  getAllConversations,
  getUnreadConversations,
} from '@/lib/db/conversation-repository';
import type { ConversationWithDetails } from '@field-service/shared-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToSyncEvents } from '@/lib/sync/sync-events';

type TabType = 'all' | 'unread';

export default function ChatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const db = getDatabase();
      const data =
        activeTab === 'all'
          ? await getAllConversations(db, user.id)
          : await getUnreadConversations(db, user.id);
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents(() => {
      void loadConversations();
    });

    return unsubscribe;
  }, [loadConversations]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: ConversationWithDetails }) => (
    <TouchableOpacity
      onPress={() => router.push(`/chat/${item.id}` as never)}
      testID="chat-conversation-item"
      style={{
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#3b82f6',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>
          {item.other_user.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 }}>
            {item.other_user.name}
          </Text>
          {item.last_message && (
            <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
              {formatTime(item.last_message.sent_at)}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 14,
              color: item.unread_count > 0 ? '#111827' : '#6b7280',
              fontWeight: item.unread_count > 0 ? '500' : '400',
            }}
          >
            {item.last_message?.content || 'No messages yet'}
          </Text>
          {item.unread_count > 0 && (
            <View
              style={{
                backgroundColor: '#3b82f6',
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
                {item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View
      testID="chat-screen"
      style={{ flex: 1, backgroundColor: '#f9fafb', paddingTop: insets.top }}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Chat</Text>
          <TouchableOpacity
            onPress={() => router.push('/chat/new' as never)}
            testID="chat-new-button"
            style={{
              backgroundColor: '#3b82f6',
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            testID="chat-tab-all"
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: activeTab === 'all' ? '#3b82f6' : '#f3f4f6',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: activeTab === 'all' ? '#ffffff' : '#6b7280',
              }}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('unread')}
            testID="chat-tab-unread"
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: activeTab === 'unread' ? '#3b82f6' : '#f3f4f6',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: activeTab === 'unread' ? '#ffffff' : '#6b7280',
              }}
            >
              Unread
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 }}>
            {activeTab === 'unread' ? 'No unread messages' : 'No conversations yet'}
          </Text>
          <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
            {activeTab === 'unread'
              ? 'All caught up!'
              : 'Start a new conversation to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
}
