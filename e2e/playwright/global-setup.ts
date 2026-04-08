import { createClient } from '@supabase/supabase-js';

/**
 * Playwright Global Setup
 *
 * Runs before all E2E tests. Resets the database to a known baseline state
 * so tests are deterministic and not flaky due to leftover data.
 *
 * Requires environment variables:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
async function globalSetup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      '[E2E Setup] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set – skipping DB seed reset.'
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log('[E2E Setup] Resetting E2E test data...');

  // ── 1. Clean up previous E2E test data ──────────────────────────────────────
  const { error: reportsError } = await supabase
    .from('reports')
    .delete()
    .like('notes', '%[E2E]%');

  if (reportsError) {
    console.error('[E2E Setup] Failed to clean reports:', reportsError.message);
  }

  const { error: tasksError } = await supabase
    .from('tasks')
    .delete()
    .like('title', '%[E2E]%');

  if (tasksError) {
    console.error('[E2E Setup] Failed to clean tasks:', tasksError.message);
  }

  // ── 2. Seed baseline tasks ───────────────────────────────────────────────────
  const baselineTasks = [
    {
      title: '[E2E] Test Task Alpha',
      description: 'Baseline E2E task for dashboard tests',
      address: '1 Test Street, Prague',
      latitude: 50.0755,
      longitude: 14.4378,
      status: 'assigned',
      priority: 'high',
      category: 'repair',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      customer_name: 'E2E Customer Alpha',
      customer_phone: '555-0001',
      estimated_time: 60,
    },
    {
      title: '[E2E] Test Task Beta',
      description: 'Baseline E2E task for task management tests',
      address: '2 Test Avenue, Prague',
      latitude: 50.0800,
      longitude: 14.4400,
      status: 'in_progress',
      priority: 'medium',
      category: 'maintenance',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      customer_name: 'E2E Customer Beta',
      customer_phone: '555-0002',
      estimated_time: 90,
    },
  ];

  const { data: insertedTasks, error: insertError } = await supabase
    .from('tasks')
    .insert(baselineTasks)
    .select('id, title');

  if (insertError) {
    console.error('[E2E Setup] Failed to seed tasks:', insertError.message);
    throw new Error(`E2E seed failed: ${insertError.message}`);
  }

  console.log(
    `[E2E Setup] Seeded ${insertedTasks?.length ?? 0} baseline tasks:`,
    insertedTasks?.map((t) => t.title).join(', ')
  );

  // ── 3. Verify baseline ───────────────────────────────────────────────────────
  const { data: verifyData, error: verifyError } = await supabase
    .from('tasks')
    .select('id')
    .like('title', '%[E2E]%');

  if (verifyError) {
    throw new Error(`E2E baseline verification failed: ${verifyError.message}`);
  }

  if (!verifyData || verifyData.length < baselineTasks.length) {
    throw new Error(
      `E2E baseline verification failed: expected ${baselineTasks.length} tasks, found ${verifyData?.length ?? 0}`
    );
  }

  console.log(`[E2E Setup] Baseline verified: ${verifyData.length} E2E tasks present.`);
}

export default globalSetup;
