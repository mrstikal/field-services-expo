'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Home, ClipboardList, Users, BarChart3, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ConversationWithDetails, Message } from '@field-service/shared-types';
import { useAuth } from '@/lib/auth-provider';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { realtimeSyncService } from '@/lib/realtime-sync';

interface DashboardLayoutProps {
  readonly children: ReactNode;
}

const SIDEBAR_BADGE_STORAGE_KEYS = {
  tasks: 'dashboard.badges.tasks.lastSeenAt',
  technicians: 'dashboard.badges.technicians.lastSeenAt',
  reports: 'dashboard.badges.reports.lastSeenAt',
} as const;

function readStoredTimestamp(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(key);
  return value && Date.parse(value) ? value : null;
}

function writeStoredTimestamp(key: string, timestamp: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, timestamp);
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unseenCounts, setUnseenCounts] = useState({
    tasks: 0,
    technicians: 0,
    reports: 0,
    chat: 0,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const refreshUnreadChatCount = useCallback(async () => {
    if (!user || pathname?.startsWith('/dashboard/chat')) {
      setUnseenCounts(prev => ({ ...prev, chat: 0 }));
      return;
    }

    try {
      const response = await authenticatedFetch('/api/chat/conversations');
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Request failed with status ${response.status}`
        );
      }

      const conversations = Array.isArray(payload?.conversations)
        ? (payload.conversations as ConversationWithDetails[])
        : [];
      const unreadMessages = conversations.reduce(
        (total, conversation) => total + Math.max(0, conversation.unread_count),
        0
      );

      setUnseenCounts(prev => ({ ...prev, chat: unreadMessages }));
    } catch (error) {
      console.error('Error loading unread chat count:', error);
    }
  }, [pathname, user]);

  const refreshServerBackedBadgeCounts = useCallback(async () => {
    if (!user) {
      return;
    }

    const now = new Date().toISOString();
    const tasksSince =
      readStoredTimestamp(SIDEBAR_BADGE_STORAGE_KEYS.tasks) ?? now;
    const techniciansSince =
      readStoredTimestamp(SIDEBAR_BADGE_STORAGE_KEYS.technicians) ?? now;
    const reportsSince =
      readStoredTimestamp(SIDEBAR_BADGE_STORAGE_KEYS.reports) ?? now;

    writeStoredTimestamp(SIDEBAR_BADGE_STORAGE_KEYS.tasks, tasksSince);
    writeStoredTimestamp(SIDEBAR_BADGE_STORAGE_KEYS.technicians, techniciansSince);
    writeStoredTimestamp(SIDEBAR_BADGE_STORAGE_KEYS.reports, reportsSince);

    try {
      const params = new URLSearchParams({
        tasksSince,
        techniciansSince,
        reportsSince,
      });
      const response = await authenticatedFetch(
        `/api/dashboard/badges?${params.toString()}`
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Request failed with status ${response.status}`
        );
      }

      setUnseenCounts(prev => ({
        ...prev,
        tasks: pathname?.startsWith('/dashboard/tasks')
          ? 0
          : Number(payload?.tasks ?? 0),
        technicians: pathname?.startsWith('/dashboard/technicians')
          ? 0
          : Number(payload?.technicians ?? 0),
        reports: pathname?.startsWith('/dashboard/reports')
          ? 0
          : Number(payload?.reports ?? 0),
      }));
    } catch (error) {
      console.error('Error loading sidebar badge counts:', error);
    }
  }, [pathname, user]);

  // Reset counts when navigating to the respective page
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/tasks')) {
      writeStoredTimestamp(
        SIDEBAR_BADGE_STORAGE_KEYS.tasks,
        new Date().toISOString()
      );
      setUnseenCounts(prev => ({ ...prev, tasks: 0 }));
    } else if (pathname?.startsWith('/dashboard/technicians')) {
      writeStoredTimestamp(
        SIDEBAR_BADGE_STORAGE_KEYS.technicians,
        new Date().toISOString()
      );
      setUnseenCounts(prev => ({ ...prev, technicians: 0 }));
    } else if (pathname?.startsWith('/dashboard/reports')) {
      writeStoredTimestamp(
        SIDEBAR_BADGE_STORAGE_KEYS.reports,
        new Date().toISOString()
      );
      setUnseenCounts(prev => ({ ...prev, reports: 0 }));
    } else if (pathname?.startsWith('/dashboard/chat')) {
      setUnseenCounts(prev => ({ ...prev, chat: 0 }));
    }
  }, [pathname]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshServerBackedBadgeCounts();
    void refreshUnreadChatCount();

    const intervalId = window.setInterval(() => {
      void refreshServerBackedBadgeCounts();
      void refreshUnreadChatCount();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, refreshServerBackedBadgeCounts, refreshUnreadChatCount]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const tasksSub = realtimeSyncService.subscribeToTasks(payload => {
      if (
        payload.eventType === 'INSERT' ||
        payload.eventType === 'UPDATE' ||
        payload.eventType === 'DELETE'
      ) {
        void refreshServerBackedBadgeCounts();
      }
    });

    const techniciansSub = realtimeSyncService.subscribeToAllTechnicians(payload => {
      if (
        payload.eventType === 'INSERT' &&
        !pathname?.startsWith('/dashboard/technicians')
      ) {
        setUnseenCounts(prev => ({ ...prev, technicians: prev.technicians + 1 }));
      }
    });

    const reportsSub = realtimeSyncService.subscribeToReports(payload => {
      if (
        payload.eventType === 'INSERT' &&
        !pathname?.startsWith('/dashboard/reports')
      ) {
        setUnseenCounts(prev => ({ ...prev, reports: prev.reports + 1 }));
      }
    });

    const chatSub = realtimeSyncService.subscribeToAllMessages(payload => {
      if (
        payload.eventType === 'INSERT' &&
        payload.newData &&
        (payload.newData as unknown as Message).sender_id !== user.id &&
        !pathname?.startsWith('/dashboard/chat')
      ) {
        void refreshUnreadChatCount();
      }
    });

    return () => {
      tasksSub.unsubscribe();
      techniciansSub.unsubscribe();
      reportsSub.unsubscribe();
      chatSub.unsubscribe();
    };
  }, [user, pathname, refreshServerBackedBadgeCounts, refreshUnreadChatCount]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    {
      href: '/dashboard/tasks',
      label: 'Tasks',
      icon: ClipboardList,
      badge: unseenCounts.tasks,
    },
    {
      href: '/dashboard/technicians',
      label: 'Technicians',
      icon: Users,
      badge: unseenCounts.technicians,
    },
    {
      href: '/dashboard/reports',
      label: 'Reports',
      icon: BarChart3,
      badge: unseenCounts.reports,
    },
    {
      href: '/dashboard/chat',
      label: 'Chat',
      icon: MessageSquare,
      badge: unseenCounts.chat,
    },
  ];

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading session...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-blue-900">Field Service</h1>
          <p className="mt-1 text-sm text-gray-500">Dispatcher Dashboard</p>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                className={`flex items-center justify-between rounded-lg px-4 py-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                href={item.href}
                key={item.href}
              >
                <div className="flex items-center">
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-4 border-t border-gray-200 p-4">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
            <p className="mt-1 text-xs text-gray-500">
              {user.role === 'dispatcher' ? 'Dispatcher' : 'Technician'}
            </p>
          </div>
          <button
            className="flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            onClick={handleSignOut}
            type="button"
          >
            <span className="mr-2">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
