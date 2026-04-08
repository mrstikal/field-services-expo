import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), 'env.local') });

export default async function globalTeardown() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn(
      '[E2E Teardown] SUPABASE_URL or SUPABASE_SERVICE_KEY not set; skipping cleanup.'
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();

  console.log('[E2E Teardown] Cleaning up E2E test data...');

  const { data: tasksToCleanup, error: tasksLookupError } = await supabase
    .from('tasks')
    .select('id')
    .like('title', '[E2E]%');

  if (tasksLookupError) {
    console.error(
      '[E2E Teardown] Error loading tasks for cleanup:',
      tasksLookupError.message
    );
    return;
  }

  const taskIds = (tasksToCleanup ?? []).map(task => task.id);

  if (taskIds.length === 0) {
    console.log('[E2E Teardown] No E2E data found.');
    return;
  }

  const { error: reportsError } = await supabase
    .from('reports')
    .update({ deleted_at: now, updated_at: now })
    .in('task_id', taskIds)
    .is('deleted_at', null);

  if (reportsError) {
    console.error(
      '[E2E Teardown] Error cleaning up reports:',
      reportsError.message
    );
  }

  const { error: tasksError } = await supabase
    .from('tasks')
    .update({ deleted_at: now, updated_at: now })
    .in('id', taskIds)
    .is('deleted_at', null);

  if (tasksError) {
    console.error(
      '[E2E Teardown] Error cleaning up tasks:',
      tasksError.message
    );
  } else {
    console.log(`[E2E Teardown] Soft-deleted ${taskIds.length} E2E task(s).`);
  }
}
