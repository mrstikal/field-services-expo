'use client';

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

interface User {
  id: string;
  email: string;
  role: 'technician' | 'dispatcher';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<string, { password: string; role: 'dispatcher' | 'technician' }> = {
  'dispatcher1@demo.cz': { password: 'demo123', role: 'dispatcher' },
  'dispatcher2@demo.cz': { password: 'demo123', role: 'dispatcher' },
  'technik1@demo.cz': { password: 'demo123', role: 'technician' },
};

const DEMO_USER_STORAGE_KEY = 'demo-auth-user';

function setDemoCookie(enabled: boolean) {
  if (typeof document === 'undefined') return;
  if (enabled) {
    document.cookie = 'demo-auth=1; Path=/; SameSite=Lax';
    return;
  }
  document.cookie = 'demo-auth=; Path=/; Max-Age=0; SameSite=Lax';
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as User;
          setUser(parsed);
          setDemoCookie(true);
          return;
        }
      }

      const { data, error } = await supabase.auth.getUser();
      
      if (data.user && !error) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: (data.user.user_metadata?.role as 'technician' | 'dispatcher') || 'dispatcher',
        };
        setUser(userData);
      }
    } catch (error) {
      console.error('Error bootstrapping auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Check demo users first (faster and always available)
      const demoUser = DEMO_USERS[email.toLowerCase()];
      if (demoUser && demoUser.password === password) {
        const userData: User = {
          id: `demo-${email.toLowerCase()}`,
          email,
          role: demoUser.role,
        };
        setUser(userData);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(userData));
        }
        setDemoCookie(true);
        return;
      }

      // Try Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If Supabase fails, show error (demo didn't match either)
        throw error;
      }

      if (data.user) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: (data.user.user_metadata?.role as 'technician' | 'dispatcher') || 'dispatcher',
        };
        setUser(userData);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        }
        setDemoCookie(false);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // In local demo mode we still clear client state even if Supabase is unreachable.
      console.error('Sign out warning:', error);
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      }
      setDemoCookie(false);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
