import { NextResponse } from 'next/server';
import { logApiError } from '@/lib/api-errors';
import { getAppUserProfile, isDispatcher } from '@/lib/server-auth';
import { requireRequestUser } from '@/lib/server-supabase';

export async function GET(request: Request) {
  try {
    const { supabase, user, error } = await requireRequestUser(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getAppUserProfile(supabase, user);
    if (!isDispatcher(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error: techniciansError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'technician')
      .order('name', { ascending: true });

    if (techniciansError) {
      throw techniciansError;
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    logApiError('technicians:list', error);
    return NextResponse.json(
      { error: 'Unable to load technicians.' },
      { status: 500 }
    );
  }
}
