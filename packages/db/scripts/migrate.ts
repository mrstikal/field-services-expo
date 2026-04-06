import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from root env.local
const rootDir = path.resolve(__dirname, '../../..');
const envPath = path.join(rootDir, 'env.local');

console.log(`Loading env from: ${envPath}`);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`.env.local not found at: ${envPath}`);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set. Please configure it in env.local');
  process.exit(1);
}

console.log('Running drizzle-kit generate...');
execSync('pnpm drizzle-kit generate', { stdio: 'inherit' });

console.log('\nApplying migrations using Supabase client...');
execSync('tsx scripts/apply-migrations.ts', { stdio: 'inherit' });

console.log('\nMigration completed successfully!');
