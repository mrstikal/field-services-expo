import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/lib/auth-context';
import { getDatabase } from '@/lib/db/local-database';
import {
  getConversationById,
  updateConversationTimestamp,
} from '@/lib/db/conversation-repository';
import {
  getMessagesByConversation,
  createMessage,
  markConversationAsRead,
} from '@/lib/db/message-repository';
import type { MessageWithSender, Conversation } from '@field-service/shared-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { subscribeToSyncEvents } from '@/lib/sync/sync-events';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const isFocused = useIsFocused();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<{ name: string; role: string } | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (id && user && isFocused) {
      void loadConversation();
      void loadMessages();
    }
  }, [id, isFocused, user]);

  useEffect(() => {
    if (!id || !user || !isFocused) {
      return;
    }

    const unsubscribe = subscribeToSyncEvents(() => {
      void loadConversation();
      void loadMessages({ silent: true });
    });

    return unsubscribe;
  }, [id, isFocused, user]);

  useEffect(() => {
    if (id && user && isFocused) {
      const hasUnreadMessages = messages.some(
        message => message.sender_id !== user.id && !message.is_read
      );

      if (hasUnreadMessages) {
        void markAsRead();
      }
    }
  }, [messages, id, isFocused, user]);

  const loadConversation = async () => {
    if (!id || !user) return;

    try {
      const db = getDatabase();
      const conv = await getConversationById(db, id);
      if (!conv) {
        router.back();
        return;
      }
      setConversation(conv);

      const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const { data } = await supabase
        .from('users')
        .select('name, role')
        .eq('id', otherUserId)
        .maybeSingle();

      if (data) {
        setOtherUser(data);
      } else {
        setOtherUser({
          name: 'Unknown User',
          role: 'technician',
        });
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const loadMessages = async (options?: { silent?: boolean }) => {
    if (!id || !user) return;

    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const db = getDatabase();
      const msgs = await getMessagesByConversation(db, id, user.id);
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const markAsRead = async () => {
    if (!id || !user) return;

    try {
      const db = getDatabase();
      await markConversationAsRead(db, id, user.id);
      setMessages(prev =>
        prev.map(message =>
          message.sender_id !== user.id ? { ...message, is_read: true } : message
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!id || !user || !messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');

    try {
      setSending(true);
      const db = getDatabase();
      const newMessage = await createMessage(db, id, user.id, text);
      await updateConversationTimestamp(db, id);

      // Add to local state immediately
      setMessages(prev => [
        ...prev,
        {
          ...newMessage,
          sender: {
            id: user.id,
            name: user.profile.name,
            avatar_url: user.profile.avatar_url,
          },
          is_read: true,
        },
      ]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item, index }: { item: MessageWithSender; index: number }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const showDate =
      index === 0 ||
      new Date(messages[index - 1].sent_at).toDateString() !==
        new Date(item.sent_at).toDateString();

    return (
      <View>
        {showDate && (
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <Text style={{ fontSize: 12, color: '#9ca3af', fontWeight: '500' }}>
              {new Date(item.sent_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
            marginBottom: 8,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              maxWidth: '75%',
              backgroundColor: isOwnMessage ? '#3b82f6' : '#ffffff',
              borderRadius: 16,
              padding: 12,
              borderWidth: isOwnMessage ? 0 : 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                color: isOwnMessage ? '#ffffff' : '#111827',
                lineHeight: 20,
              }}
            >
              {item.content}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: isOwnMessage ? 'rgba(255, 255, 255, 0.7)' : '#9ca3af',
                marginTop: 4,
              }}
            >
              {formatTime(item.sent_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!conversation || !otherUser) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="chat-detail-screen"
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.replace('/chat' as never)}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: otherUser.role === 'dispatcher' ? '#8b5cf6' : '#3b82f6',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              {otherUser.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827' }}>
              {otherUser.name}
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>
              {otherUser.role === 'dispatcher' ? 'Dispatcher' : 'Technician'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="chatbubble-outline" size={64} color="#d1d5db" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 }}>
            No messages yet
          </Text>
          <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
            Start the conversation by sending a message
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            testID="chat-message-input"
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: '#f3f4f6',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 16,
              color: '#111827',
              maxHeight: 100,
            }}
            editable={!sending}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
            testID="chat-send-button"
            style={{
              marginLeft: 8,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: messageText.trim() && !sending ? '#3b82f6' : '#e5e7eb',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={messageText.trim() ? '#ffffff' : '#9ca3af'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
