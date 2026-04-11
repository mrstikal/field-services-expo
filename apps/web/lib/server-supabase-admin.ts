import path from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFilesIfNeeded() {
  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY
  ) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as typeof import('dotenv');
  const visited = new Set<string>();
  let currentDir = process.cwd();

  for (let i = 0; i < 6; i++) {
    const candidates = [
      path.join(currentDir, 'env.local'),
      path.join(currentDir, '.env.local'),
    ];

    for (const candidate of candidates) {
      if (!visited.has(candidate) && existsSync(candidate)) {
        visited.add(candidate);
        dotenv.config({ path: candidate, override: false });
      }
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }
}

export function createServiceRoleClient() {
  loadEnvFilesIfNeeded();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl ? 'SUPABASE URL' : null,
      !serviceRoleKey ? 'SUPABASE service role key' : null,
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(`Missing required Supabase server env: ${missing}.`);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
