import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth-provider';

export const metadata = {
  title: 'Field Service - Dispečer',
  description: 'Field Service Management Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}