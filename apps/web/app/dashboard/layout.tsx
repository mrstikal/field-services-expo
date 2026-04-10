'use client';

import { ReactNode, useEffect } from 'react';
import { Home, ClipboardList, Users, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';

interface DashboardLayoutProps {
  readonly children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
    { href: '/dashboard/technicians', label: 'Technicians', icon: Users },
    { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
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
                className={`flex items-center rounded-lg px-4 py-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                href={item.href}
                key={item.href}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
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
