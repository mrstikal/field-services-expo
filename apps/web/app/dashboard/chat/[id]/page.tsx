'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MessageSquare, Send } from 'lucide-react';
import type { ConversationWithDetails, MessageWithSender } from '@field-service/shared-types';
import { useAuth } from '@/lib/auth-provider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

async function readJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export default function ChatDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (id && user) {
      void loadChat();
    }
  }, [id, user]);

  useEffect(() => {
    if (messages.length === 0 || !user) {
      return;
    }

    scrollToBottom();

    const hasUnreadForeignMessages = messages.some(
      message => message.sender_id !== user.id && !message.is_read
    );

    if (hasUnreadForeignMessages) {
      void markAsRead();
    }
  }, [messages, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChat = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);

      const [conversationResponse, messagesResponse] = await Promise.all([
        authenticatedFetch(`/api/chat/conversations/${id}`),
        authenticatedFetch(`/api/chat/conversations/${id}/messages`),
      ]);

      const [conversationPayload, messagesPayload] = await Promise.all([
        readJsonResponse(conversationResponse),
        readJsonResponse(messagesResponse),
      ]);

      if (!conversationResponse.ok) {
        if (conversationResponse.status === 404) {
          router.back();
          return;
        }

        throw new Error(
          typeof conversationPayload?.error === 'string'
            ? conversationPayload.error
            : `Conversation request failed with status ${conversationResponse.status}`
        );
      }

      if (!messagesResponse.ok) {
        throw new Error(
          typeof messagesPayload?.error === 'string'
            ? messagesPayload.error
            : `Messages request failed with status ${messagesResponse.status}`
        );
      }

      setConversation(conversationPayload as ConversationWithDetails);
      setMessages(
        Array.isArray(messagesPayload?.messages)
          ? (messagesPayload.messages as MessageWithSender[])
          : []
      );
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!id || !user) return;

    try {
      const response = await authenticatedFetch(
        `/api/chat/conversations/${id}/read`,
        {
          method: 'POST',
        }
      );

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Read request failed with status ${response.status}`
        );
      }

      setMessages(previous =>
        previous.map(message =>
          message.sender_id !== user.id
            ? { ...message, is_read: true }
            : message
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const submitMessage = async () => {
    if (!id || !user || !messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');

    try {
      setSending(true);

      const response = await authenticatedFetch(
        `/api/chat/conversations/${id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: text }),
        }
      );

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Send request failed with status ${response.status}`
        );
      }

      const newMessage = payload?.message as MessageWithSender | undefined;
      if (!newMessage) {
        throw new Error('Chat service did not return a message.');
      }

      setMessages(previous => [...previous, newMessage]);
      setConversation(previous =>
        previous
          ? {
              ...previous,
              last_message: newMessage,
              updated_at: newMessage.sent_at,
            }
          : previous
      );
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading || !conversation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white ${
              conversation.other_user.role === 'dispatcher'
                ? 'bg-purple-600'
                : 'bg-blue-600'
            }`}
          >
            {conversation.other_user.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {conversation.other_user.name}
            </h1>
            <p className="text-sm text-gray-500">
              {conversation.other_user.role === 'dispatcher'
                ? 'Dispatcher'
                : 'Technician'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <MessageSquare className="h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-600">No messages yet</h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              Start the conversation by sending a message
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((msg, index) => {
              const isOwnMessage = msg.sender_id === user?.id;
              const showDate =
                index === 0 ||
                new Date(messages[index - 1].sent_at).toDateString() !==
                  new Date(msg.sent_at).toDateString();

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="my-4 text-center">
                      <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                        {formatDate(msg.sent_at)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-200 bg-white text-gray-900'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <p
                        className={`mt-1 text-xs ${
                          isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitMessage();
              }
            }}
            placeholder="Type a message..."
            disabled={sending}
            rows={1}
            maxLength={1000}
            className="max-h-[120px] flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
