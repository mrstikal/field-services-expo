import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

interface User {
  id: string;
  email: string;
  role: 'technician' | 'dispatcher';
  profile: {
    name: string;
    phone: string;
    avatar_url: string | null;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on app start
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      // Check if we have a stored session
      const storedSession = await SecureStore.getItemAsync('auth_session');
      
      if (storedSession) {
        JSON.parse(storedSession);
        // Verify session is still valid with Supabase
        const { data, error } = await supabase.auth.getUser();
        
        if (data.user && !error) {
          // Session is valid, restore user
          const userData: User = {
            id: data.user.id,
            email: data.user.email || '',
            role: (data.user.user_metadata?.role as 'technician' | 'dispatcher') || 'technician',
            profile: {
              name: data.user.user_metadata?.name || '',
              phone: data.user.user_metadata?.phone || '',
              avatar_url: data.user.user_metadata?.avatar_url || null,
            },
          };
          setUser(userData);
        } else {
          // Session invalid, clear storage
          await SecureStore.deleteItemAsync('auth_session');
        }
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
          role: (data.user.user_metadata?.role as 'technician' | 'dispatcher') || 'technician',
          profile: {
            name: data.user.user_metadata?.name || '',
            phone: data.user.user_metadata?.phone || '',
            avatar_url: data.user.user_metadata?.avatar_url || null,
          },
        };

        // Store session securely
        await SecureStore.setItemAsync('auth_session', JSON.stringify(data.session));
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
      await SecureStore.deleteItemAsync('auth_session');
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
        isSignedIn: !!user,
      }}
    >
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
