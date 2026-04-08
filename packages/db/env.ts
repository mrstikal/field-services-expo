import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

let hasLoadedServerEnv = false;
let checkedEnvPaths: string[] = [];

function collectAncestorDirs(startDir: string) {
  const dirs: string[] = [];
  let currentDir = path.resolve(startDir);

  while (true) {
    dirs.push(currentDir);
    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return dirs;
}

function collectEnvCandidates() {
  const seen = new Set<string>();
  const startDirs = new Set<string>([process.cwd(), __dirname]);

  for (const startDir of startDirs) {
    for (const dir of collectAncestorDirs(startDir)) {
      for (const relativePath of [
        'env.local',
        '.env.local',
        '.env',
        path.join('apps', 'web', '.env.local'),
        path.join('apps', 'web', '.env'),
      ]) {
        const candidate = path.resolve(dir, relativePath);
        seen.add(candidate);
      }
    }
  }

  return [...seen];
}

export function ensureServerEnvLoaded() {
  if (hasLoadedServerEnv) {
    return;
  }

  checkedEnvPaths = collectEnvCandidates();

  for (const envPath of checkedEnvPaths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    loadDotenv({
      path: envPath,
      override: false,
      quiet: true,
    });
  }

  hasLoadedServerEnv = true;
}

export function getDatabaseUrl(): string {
  ensureServerEnvLoaded();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      [
        'DATABASE_URL environment variable is not set.',
        `cwd: ${process.cwd()}`,
        `checked env files: ${checkedEnvPaths.join(', ')}`,
      ].join(' ')
    );
  }

  return databaseUrl;
}

export function getSupabaseServerUrl(): string {
  ensureServerEnvLoaded();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'Supabase URL is not set. Expected NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.'
    );
  }

  return supabaseUrl;
}

export function getSupabaseServiceRoleKey(): string {
  ensureServerEnvLoaded();

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'Supabase service role key is not set. Expected SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY.'
    );
  }

  return serviceRoleKey;
}
