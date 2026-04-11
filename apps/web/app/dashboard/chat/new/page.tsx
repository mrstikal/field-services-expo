'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Loader2, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

export default function NewChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadUsers();
    }
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

      const response = await authenticatedFetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otherUserId: selectedUser.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Request failed with status ${response.status}`
        );
      }

      const conversationId =
        typeof payload?.conversationId === 'string'
          ? payload.conversationId
          : null;

      if (!conversationId) {
        throw new Error('Chat service did not return a conversation id.');
      }

      router.push(`/dashboard/chat/${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            disabled={creating}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">New Message</h1>
        </div>

        {/* Search Input */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            disabled={creating}
            className="flex-1 border-none bg-transparent text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              disabled={creating}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <UsersIcon className="h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-600">
              {searchQuery ? 'No users found' : 'No users available'}
            </h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              {searchQuery
                ? 'Try a different search term'
                : 'There are no other users in the system'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u)}
                disabled={creating}
                className="flex w-full items-center gap-4 bg-white p-4 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${
                    u.role === 'dispatcher' ? 'bg-purple-600' : 'bg-blue-600'
                  }`}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{u.name}</h3>
                  <p className="text-sm text-gray-500">
                    {u.role === 'dispatcher' ? 'Dispatcher' : 'Technician'}
                  </p>
                </div>

                <div className="text-gray-400">→</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {creating && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-2 text-sm text-gray-600">Opening chat...</p>
          </div>
        </div>
      )}
    </div>
  );
}
