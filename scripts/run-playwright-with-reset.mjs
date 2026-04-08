#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('pnpm', ['run', 'demo:reset']);
run('pnpm', ['exec', 'playwright', 'test'], {
  ...process.env,
  E2E_RESET_DEMO_DATA: '1',
});
