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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: (data.user.user_metadata?.role as 'technician' | 'dispatcher') || 'dispatcher',
        };
        setUser(userData);
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
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
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
