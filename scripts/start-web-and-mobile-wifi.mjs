#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const webPort = 3000;
const metroPort = 8081;
const managedPorts = [8080, metroPort];

const children = [];
let isShuttingDown = false;
let shutdownPromise = null;

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runPowerShell(command) {
  return runCommand('powershell.exe', ['-NoProfile', '-Command', command]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    `if command -v lsof >/dev/null 2>&1; then lsof -tiTCP:${portToCheck} -sTCP:LISTEN; elif command -v fuser >/dev/null 2>&1; then fuser ${portToCheck}/tcp 2>/dev/null | tr ' ' '\\n'; fi`,
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

function killPid(pid) {
  if (isWindows) {
    const result = runCommand('taskkill.exe', ['/PID', String(pid), '/F', '/T']);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();

    if (result.status !== 0 && !/not found|no running instance|not been found/i.test(output)) {
      throw new Error(output || `Failed to terminate PID ${pid}.`);
    }

    return;
  }

  try {
    process.kill(Number(pid), 'SIGKILL');
  } catch {
    // Process may have already exited.
  }
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

async function releasePort(port) {
  const pids = getListeningPids(port);

  if (pids.length === 0) {
    return;
  }

  console.log(`[dev:all:wifi] Releasing port ${port} by stopping PID(s): ${pids.join(', ')}`);
  for (const pid of pids) {
    killPid(pid);
  }

  await waitForPortToBeFree(port);
}

function scoreInterface(name) {
  const normalizedName = name.toLowerCase();
  if (/wi-?fi|wlan|wireless/.test(normalizedName)) return 4;
  if (/eth|en/.test(normalizedName)) return 3;
  if (/local area connection|ethernet/.test(normalizedName)) return 2;
  return 1;
}

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      if (info.internal || info.family !== 'IPv4') {
        continue;
      }

      candidates.push({ name, address: info.address, score: scoreInterface(name) });
    }
  }

  if (candidates.length === 0) {
    throw new Error('Could not detect a LAN IPv4 address. Connect this computer to Wi-Fi/LAN and try again.');
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return candidates[0].address;
}

function startProcess(name, args, env = process.env) {
  console.log(`[dev:all:wifi] Starting ${name}: pnpm ${args.join(' ')}`);

  const command = isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm';
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'pnpm', ...args] : args;

  const child = spawn(command, commandArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env,
  });

  children.push({ name, child });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    if (signal) {
      console.log(`[dev:all:wifi] ${name} exited with signal ${signal}. Stopping remaining process(es).`);
    } else {
      console.log(`[dev:all:wifi] ${name} exited with code ${code ?? 0}. Stopping remaining process(es).`);
    }

    void shutdown(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[dev:all:wifi] Failed to start ${name}: ${error.message}`);
    void shutdown(1);
  });
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

async function shutdown(exitCode = 0) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  isShuttingDown = true;

  shutdownPromise = (async () => {
    for (const { name, child } of children) {
      if (!child.pid) {
        continue;
      }

      try {
        killProcessTree(child.pid);
      } catch (error) {
        console.warn(`[dev:all:wifi] Failed to stop ${name} (PID ${child.pid}): ${error.message}`);
      }
    }

    process.exit(exitCode);
  })();

  return shutdownPromise;
}

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

async function main() {
  for (const port of managedPorts) {
    await releasePort(port);
  }

  const lanIp = detectLanIp();
  const mobileEnv = {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
    EXPO_DEVTOOLS_LISTEN_ADDRESS: '0.0.0.0',
    EXPO_PUBLIC_API_URL: `http://${lanIp}:${webPort}`,
  };
  const directExpoGoUrl = `exp://${lanIp}:${metroPort}/--/`;

  console.log(`[dev:all:wifi] Using LAN IP ${lanIp} for Expo Go`);
  console.log(`[dev:all:wifi] Mobile API URL: ${mobileEnv.EXPO_PUBLIC_API_URL}`);
  console.log(`[dev:all:wifi] Direct Expo Go URL: ${directExpoGoUrl}`);
  console.log('[dev:all:wifi] Scan ONLY this QR in Expo Go. Ignore Expo CLI QR output.');
  qrcode.generate(directExpoGoUrl, { small: true });

  startProcess('web', ['--filter', 'field-service-web', 'exec', 'next', 'dev', '--hostname', '0.0.0.0', '--port', String(webPort)]);
  startProcess('mobile', [
    '--filter',
    'field-service-mobile',
    'exec',
    'expo',
    'start',
    '--go',
    '--host',
    'lan',
    '--port',
    String(metroPort),
    '--clear',
    '--non-interactive',
  ], mobileEnv);
}

main().catch((error) => {
  console.error(`[dev:all:wifi] ${error.message}`);
  void shutdown(1);
});
