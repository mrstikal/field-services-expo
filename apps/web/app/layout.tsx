import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth-provider';

export const metadata = {
  title: 'Field Service - Dispatcher',
  description: 'Field Service Management Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}