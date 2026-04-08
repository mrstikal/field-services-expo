import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type { BusinessRole } from '@field-service/shared-types';
import { supabase } from './supabase';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

interface User {
  id: string;
  email: string;
  role: BusinessRole;
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

function createFallbackUser(
  authUser: { id: string; email?: string | null },
  existingUser: User | null = null
): User {
  const sameUser = existingUser?.id === authUser.id ? existingUser : null;

  return {
    id: authUser.id,
    email: authUser.email ?? sameUser?.email ?? '',
    role: sameUser?.role ?? 'technician',
    profile: {
      name: sameUser?.profile.name ?? '',
      phone: sameUser?.profile.phone ?? '',
      avatar_url: sameUser?.profile.avatar_url ?? null,
    },
  };
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  timeoutMs: number = AUTH_BOOTSTRAP_TIMEOUT_MS
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function buildCurrentUser(
  authUser: { id: string; email?: string | null } | null | undefined,
  existingUser: User | null = null
): Promise<User | null> {
  if (!authUser) {
    return null;
  }

  try {
    const { data: profile, error: profileError } = await withTimeout(
      supabase
        .from('users')
        .select('id, email, role, name, phone, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle(),
      'users profile lookup'
    );

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      throw new Error('Missing application profile for authenticated user.');
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role as BusinessRole,
      profile: {
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        avatar_url: profile.avatar_url,
      },
    };
  } catch (error) {
    if (existingUser?.id === authUser.id || authUser.email) {
      return createFallbackUser(authUser, existingUser);
    }

    throw error;
  }
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastResolvedUserRef = useRef<User | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrapAsync = async () => {
      try {
        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          'supabase.auth.getSession'
        );

        const currentUser = await buildCurrentUser(
          session?.user,
          lastResolvedUserRef.current
        );
        if (active) {
          setUser(currentUser);
          lastResolvedUserRef.current = currentUser;
        }
      } catch (error) {
        console.warn(
          'Auth bootstrap failed, falling back to signed-out state:',
          error
        );
        if (active) {
          setUser(null);
          lastResolvedUserRef.current = null;
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    bootstrapAsync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!session?.user) {
          if (active) {
            setUser(null);
            lastResolvedUserRef.current = null;
          }
          return;
        }

        const currentUser = await buildCurrentUser(
          session.user,
          lastResolvedUserRef.current
        );
        if (active) {
          setUser(currentUser);
          lastResolvedUserRef.current = currentUser;
        }
      } catch (error) {
        console.warn('Auth state change user resolution failed:', error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const currentUser = await buildCurrentUser(
        data.user ?? data.session?.user ?? null,
        lastResolvedUserRef.current
      );
      setUser(currentUser);
      lastResolvedUserRef.current = currentUser;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setUser(null);
      lastResolvedUserRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut, isSignedIn: !!user }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
