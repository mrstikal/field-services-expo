import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

function isEnabled(value: string | undefined) {
  return /^(1|true|yes)$/i.test(value ?? '');
}

export default async function globalSetup() {
  dotenv.config({ path: path.join(process.cwd(), 'env.local') });

  if (!isEnabled(process.env.E2E_RESET_DEMO_DATA)) {
    console.log(
      '[E2E Setup] Demo reset is disabled by default. Set E2E_RESET_DEMO_DATA=1 to run the destructive Supabase seed reset before Playwright.'
    );
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      '[E2E Setup] E2E_RESET_DEMO_DATA=1 requires SUPABASE_URL and SUPABASE_SERVICE_KEY in env.local.'
    );
  }

  console.log(
    '[E2E Setup] Resetting demo data before Playwright run (explicit opt-in)...'
  );
  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'scripts', 'reset-supabase.mjs')],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `E2E demo reset failed with exit code ${result.status ?? 1}.`
    );
  }
}
