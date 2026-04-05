import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              // Ignored in contexts where cookies cannot be mutated.
            }
          },
        },
      }
    );

    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();

    if (!id) {
      return Response.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const updateData = await request.json();

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    return Response.json(task, { status: 200 });
  } catch (error) {
    console.error('Unexpected error updating task:', error);
    return Response.json(
      { error: 'An unexpected error occurred while updating the task' },
      { status: 500 }
    );
  }
}

