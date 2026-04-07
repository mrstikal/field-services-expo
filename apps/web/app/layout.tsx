import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@lib/auth-provider';
import { QueryProvider } from '@lib/query-provider';

export const metadata: Metadata = {
  title: 'Field Service - Dispatcher',
  description: 'Field Service Management Dashboard',
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
