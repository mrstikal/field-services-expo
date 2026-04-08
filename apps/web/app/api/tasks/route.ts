import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await getSupabaseClient();
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*');

    if (error) {
      console.error('Error fetching tasks:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(tasks, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching tasks:', error);
    return Response.json(
      { error: 'An unexpected error occurred while fetching tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    
    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.description || !data.address) {
      return Response.json(
        { error: 'Title, description, and address are required' }, 
        { status: 400 }
      );
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([data])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
      return Response.json({ error: error.message }, { status: 400 });
    }
    
    return Response.json(task, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating task:', error);
    return Response.json(
      { error: 'An unexpected error occurred while creating the task' }, 
      { status: 500 }
    );
  }
}
