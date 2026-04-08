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
            // Ignored in contexts where cookies cannot be mutated.
          }
        },
      },
    }
  );
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await getSupabaseClient();
    const id = params.id;

    if (!id) {
      return Response.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching task:', error);
      return Response.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 400 });
    }

    return Response.json(task, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching task:', error);
    return Response.json(
      { error: 'An unexpected error occurred while fetching the task' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await getSupabaseClient();
    const id = params.id;

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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // PATCH and PUT are similar in this implementation as both use Supabase .update()
  return PUT(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await getSupabaseClient();
    const id = params.id;

    if (!id) {
      return Response.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Unexpected error deleting task:', error);
    return Response.json(
      { error: 'An unexpected error occurred while deleting the task' },
      { status: 500 }
    );
  }
}
