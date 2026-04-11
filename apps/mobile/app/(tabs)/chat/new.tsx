import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { upsertChatUsers } from '@/lib/db/chat-user-repository';
import { getDatabase } from '@/lib/db/local-database';
import { getOrCreateConversation } from '@/lib/db/conversation-repository';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

export default function NewChatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, avatar_url')
        .neq('id', user.id)
        .order('name');

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);

      const db = getDatabase();
      await upsertChatUsers(db, [
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.profile.name,
          phone: user.profile.phone,
          avatar_url: user.profile.avatar_url,
        },
        ...(data || []).map(item => ({
          id: item.id,
          email: item.email,
          role: item.role,
          name: item.name,
          phone: null,
          avatar_url: item.avatar_url,
        })),
      ]);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (selectedUser: User) => {
    if (!user || creating) return;

    try {
      setCreating(true);
      const db = getDatabase();
      await upsertChatUsers(db, [
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.profile.name,
          phone: user.profile.phone,
          avatar_url: user.profile.avatar_url,
        },
        {
          id: selectedUser.id,
          email: selectedUser.email,
          role: selectedUser.role,
          name: selectedUser.name,
          phone: null,
          avatar_url: selectedUser.avatar_url,
        },
      ]);
      const conversation = await getOrCreateConversation(
        db,
        user.id,
        selectedUser.id
      );
      router.replace(`/chat/${conversation.id}` as never);
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert(
        'Unable to open chat',
        'Please try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      onPress={() => handleSelectUser(item)}
      disabled={creating}
      testID="chat-user-item"
      style={{
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        opacity: creating ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: item.role === 'dispatcher' ? '#8b5cf6' : '#3b82f6',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 }}>
          {item.name}
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280' }}>
          {item.role === 'dispatcher' ? 'Dispatcher' : 'Technician'}
        </Text>
      </View>

      <View style={{ justifyContent: 'center' }}>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View
      testID="chat-new-screen"
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
            disabled={creating}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>
            New Message
          </Text>
        </View>

        {/* Search Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f3f4f6',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="search" size={20} color="#6b7280" style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="chat-user-search-input"
            placeholder="Search users..."
            placeholderTextColor="#9ca3af"
            style={{
              flex: 1,
              fontSize: 16,
              color: '#111827',
            }}
            editable={!creating}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} disabled={creating}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Users List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="people-outline" size={64} color="#d1d5db" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 }}>
            {searchQuery ? 'No users found' : 'No users available'}
          </Text>
          <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
            {searchQuery
              ? 'Try a different search term'
              : 'There are no other users in the system'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={item => item.id}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}

      {creating && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 12, fontSize: 16, color: '#6b7280' }}>
              Opening chat...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
