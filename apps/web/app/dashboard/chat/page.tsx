'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Plus } from 'lucide-react';
import type { ConversationWithDetails } from '@field-service/shared-types';
import { useAuth } from '@/lib/auth-provider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

function getErrorDebugPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return {
      type: 'object',
      message: typeof err.message === 'string' ? err.message : undefined,
      code: typeof err.code === 'string' ? err.code : undefined,
      details: typeof err.details === 'string' ? err.details : undefined,
      hint: typeof err.hint === 'string' ? err.hint : undefined,
      status: typeof err.status === 'number' ? err.status : undefined,
      keys: Object.keys(err),
      stringified: (() => {
        try {
          return JSON.stringify(err);
        } catch {
          return '[unserializable object]';
        }
      })(),
    };
  }

  return {
    type: typeof error,
    value: String(error),
  };
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      void loadConversations();
    }
  }, [user, activeTab]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const response = await authenticatedFetch('/api/chat/conversations');
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Request failed with status ${response.status}`
        );
      }

      const allConversations = Array.isArray(payload?.conversations)
        ? (payload.conversations as ConversationWithDetails[])
        : [];

      const filtered =
        activeTab === 'unread'
          ? allConversations.filter(conversation => conversation.unread_count > 0)
          : allConversations;

      setConversations(filtered);
    } catch (error) {
      console.error(
        'Error loading conversations:',
        getErrorDebugPayload(error)
      );
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
          <button
            onClick={() => router.push('/dashboard/chat/new')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Message
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <MessageSquare className="h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-600">
              {activeTab === 'unread' ? 'No unread messages' : 'No conversations yet'}
            </h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              {activeTab === 'unread'
                ? 'All caught up!'
                : 'Start a new conversation to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => router.push(`/dashboard/chat/${conv.id}`)}
                className="flex w-full items-center gap-4 bg-white p-4 text-left transition-colors hover:bg-gray-50"
              >
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${
                    conv.other_user.role === 'dispatcher' ? 'bg-purple-600' : 'bg-blue-600'
                  }`}
                >
                  {conv.other_user.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate font-semibold text-gray-900">
                      {conv.other_user.name}
                    </h3>
                    {conv.last_message && (
                      <span className="ml-2 text-xs text-gray-500">
                        {formatTime(conv.last_message.sent_at)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p
                      className={`truncate text-sm ${
                        conv.unread_count > 0
                          ? 'font-medium text-gray-900'
                          : 'text-gray-500'
                      }`}
                    >
                      {conv.last_message?.content || 'No messages yet'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
