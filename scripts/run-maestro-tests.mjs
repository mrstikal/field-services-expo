#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const maestroDir = path.join(projectRoot, 'e2e', 'maestro');
const webDir = path.join(projectRoot, 'apps', 'web');
const isWindows = process.platform === 'win32';
const metroPort = 8081;
const webPort = 3000;

let devAllProcess = null;

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .replace(/\//g, '\\')
    .toLowerCase();
}

function runPowerShell(command) {
  return runCommand('powershell.exe', ['-NoProfile', '-Command', command]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPort(port, timeoutMs = 60_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}.`));
          return;
        }

        setTimeout(tryConnect, 1000);
      });
    };

    tryConnect();
  });
}

function checkPortAvailable(portToCheck) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(portToCheck, '127.0.0.1');
  });
}

async function waitForPortToBeFree(port, timeoutMs = 15_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await checkPortAvailable(port)) {
      return;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for port ${port} to be released.`);
}

function getListeningPidsOnWindows(portToCheck) {
  const result = runPowerShell(
    `Get-NetTCPConnection -State Listen -LocalPort ${portToCheck} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`
  );

  if (result.status === 0) {
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
  }

  const fallback = runCommand('cmd.exe', ['/d', '/s', '/c', 'netstat -ano -p tcp']);
  if (fallback.status !== 0) {
    throw new Error(fallback.stderr.trim() || fallback.stdout.trim() || 'Failed to inspect TCP listeners on Windows.');
  }

  const pids = new Set();
  for (const rawLine of fallback.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('TCP')) {
      continue;
    }

    const columns = line.split(/\s+/);
    const localAddress = columns[1] ?? '';
    const state = columns[3] ?? '';
    const pid = columns[4] ?? '';

    if (!localAddress.endsWith(`:${portToCheck}`) || state.toUpperCase() !== 'LISTENING' || !/^\d+$/.test(pid)) {
      continue;
    }

    pids.add(pid);
  }

  return [...pids];
}

function getListeningPidsOnPosix(portToCheck) {
  const result = runCommand('sh', [
    '-lc',
    `if command -v lsof >/dev/null 2>&1; then lsof -tiTCP:${portToCheck} -sTCP:LISTEN; elif command -v fuser >/dev/null 2>&1; then fuser ${portToCheck}/tcp 2>/dev/null | tr ' ' '\n'; fi`,
  ]);

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'Failed to inspect TCP listeners on POSIX.');
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line));
}

function getListeningPids(portToCheck) {
  return isWindows ? getListeningPidsOnWindows(portToCheck) : getListeningPidsOnPosix(portToCheck);
}

function getWindowsProcessInfo(pid) {
  const result = runPowerShell(
    `$p = Get-CimInstance Win32_Process -Filter \"ProcessId = ${Number(pid)}\" -ErrorAction SilentlyContinue; if ($null -ne $p) { [PSCustomObject]@{ processId = $p.ProcessId; parentProcessId = $p.ParentProcessId; name = $p.Name; commandLine = $p.CommandLine } | ConvertTo-Json -Compress }`
  );

  const stdout = result.stdout.trim();
  if (result.status !== 0 || !stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function getWindowsProcessChain(startPid, maxDepth = 12) {
  const chain = [];
  const seen = new Set();
  let currentPid = Number(startPid);

  while (Number.isFinite(currentPid) && currentPid > 0 && !seen.has(currentPid) && chain.length < maxDepth) {
    seen.add(currentPid);

    const info = getWindowsProcessInfo(currentPid);
    if (!info) {
      break;
    }

    chain.push(info);
    currentPid = Number(info.parentProcessId);
  }

  return chain;
}

function isWorkspaceWebProcessChain(chain) {
  const normalizedProjectRoot = normalizeForMatch(projectRoot);
  const normalizedWebDir = normalizeForMatch(webDir);

  return chain.some((info) => {
    const commandLine = normalizeForMatch(info.commandLine);

    return (
      commandLine.includes(normalizedProjectRoot) ||
      commandLine.includes(normalizedWebDir) ||
      commandLine.includes('field-service-web') ||
      commandLine.includes('start-web-and-mobile.mjs')
    );
  });
}

function summarizeProcessChain(chain) {
  return chain
    .map((info) => `${info.processId}:${(info.commandLine ?? info.name ?? '').trim()}`)
    .join(' <- ');
}

function killProcessTree(pid) {
  if (!pid) {
    return;
  }

  if (isWindows) {
    const result = runCommand('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();

    if (result.status !== 0 && !/not found|no running instance|not been found/i.test(output)) {
      throw new Error(output || `Failed to terminate PID ${pid}.`);
    }

    return;
  }

  try {
    process.kill(-Number(pid), 'SIGTERM');
  } catch {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      // Best effort shutdown.
    }
  }
}

async function ensureWebPortReady() {
  const pids = getListeningPids(webPort);

  if (pids.length === 0) {
    return;
  }

  const stalePids = [];
  const foreignProcesses = [];

  for (const pid of pids) {
    if (!isWindows) {
      foreignProcesses.push({ pid, description: `PID ${pid}` });
      continue;
    }

    const chain = getWindowsProcessChain(pid);
    const description = chain.length > 0 ? summarizeProcessChain(chain) : `PID ${pid}`;

    if (isWorkspaceWebProcessChain(chain)) {
      stalePids.push({ pid, description });
      continue;
    }

    foreignProcesses.push({ pid, description });
  }

  if (foreignProcesses.length > 0) {
    throw new Error(
      [`Port ${webPort} is already in use by another process.`, ...foreignProcesses.map((item) => `- ${item.description}`)].join('\n')
    );
  }

  console.log(`[dev:all] Releasing stale web server on port ${webPort}: ${stalePids.map((item) => item.pid).join(', ')}`);

  for (const { pid } of stalePids) {
    killProcessTree(pid);
  }

  await waitForPortToBeFree(webPort);
}

function checkMaestroInstallation() {
  const result = runCommand('maestro', ['--version'], { stdio: 'pipe' });
  if (result.error) {
    console.error('Error: Maestro CLI is not installed or not in PATH.');
    console.error('Please install Maestro CLI: https://maestro.mobile.dev/getting-started/installing-maestro');
    process.exit(1);
  }
  console.log(`Maestro CLI version: ${result.stdout.toString().trim()}`);
}

async function runMaestroTests() {
  checkMaestroInstallation();

  console.log('[Maestro E2E] Starting dev:all process...');
  devAllProcess = spawn('pnpm', ['run', 'dev:all'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  devAllProcess.on('error', (err) => {
    console.error('[Maestro E2E] Failed to start dev:all process:', err);
    shutdown(1);
  });

  console.log('[Maestro E2E] Waiting for web and metro servers to be ready...');
  try {
    await Promise.all([
      waitForPort(webPort, 120_000), // Wait up to 2 minutes for web server
      waitForPort(metroPort, 120_000), // Wait up to 2 minutes for metro server
    ]);
    console.log('[Maestro E2E] Web and Metro servers are ready.');
  } catch (error) {
    console.error('[Maestro E2E] Error waiting for servers:', error.message);
    shutdown(1);
    return;
  }

  console.log(`Running Maestro tests from: ${maestroDir}`);
  const maestroResult = runCommand('maestro', ['test', `${maestroDir}/*.yaml`]);

  if (maestroResult.status !== 0) {
    console.error(`Maestro tests failed with exit code ${maestroResult.status}`);
    shutdown(maestroResult.status);
  } else {
    console.log('Maestro tests completed successfully.');
    shutdown(0);
  }
}

function shutdown(exitCode = 0) {
  if (devAllProcess && !devAllProcess.killed) {
    console.log('[Maestro E2E] Shutting down dev:all process...');
    killProcessTree(devAllProcess.pid);
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

runMaestroTests().catch((error) => {
  console.error('An unexpected error occurred:', error);
  shutdown(1);
});
