'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ClipboardList, Users, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary">Field Service</h1>
          <p className="text-sm text-gray-500">Dispatcher</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Overview
            </Button>
          </Link>
          <Link href="/dashboard/tasks">
            <Button variant="ghost" className="w-full justify-start">
              <ClipboardList className="mr-2 h-4 w-4" />
              Tasks
            </Button>
          </Link>
          <Link href="/dashboard/technicians">
            <Button variant="ghost" className="w-full justify-start">
              <Users className="mr-2 h-4 w-4" />
              Technicians
            </Button>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden p-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-bold">Field Service</h1>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
