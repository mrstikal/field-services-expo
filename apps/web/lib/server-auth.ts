import type { User } from '@supabase/supabase-js';
import type { BusinessRole } from '@field-service/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppUserProfile {
  id: string;
  email: string;
  role: BusinessRole;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export async function getAppUserProfile(
  supabase: SupabaseClient,
  authUser: User
): Promise<AppUserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, name, phone, avatar_url')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to load application user profile.');
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role as BusinessRole,
    name: data.name,
    phone: data.phone,
    avatar_url: data.avatar_url,
  };
}

export function isDispatcher(
  profile: AppUserProfile | null | undefined
): profile is AppUserProfile {
  return profile?.role === 'dispatcher';
}
