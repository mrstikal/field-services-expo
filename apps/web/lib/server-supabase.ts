import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

type TypedSupabaseClient = SupabaseClient;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  }
  return url;
}

function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return key;
}

export async function createRouteHandlerSupabaseClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Route handlers can mutate cookies. Server components cannot.
        }
      },
    },
  });
}

export function createBearerSupabaseClient(
  accessToken: string
): TypedSupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function requireRouteUser() {
  const supabase = await createRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

export async function requireRequestUser(request?: NextRequest | Request) {
  const authorizationHeader = request?.headers.get('authorization');
  const bearerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : '';

  if (bearerToken) {
    const { supabase, user } = await requireBearerUser(bearerToken);
    return { supabase, user, error: user ? null : new Error('Unauthorized') };
  }

  return requireRouteUser();
}

export async function requireBearerUser(
  accessToken: string
): Promise<{ supabase: TypedSupabaseClient; user: User | null }> {
  const supabase = createBearerSupabaseClient(accessToken);
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);

  return { supabase, user };
}
