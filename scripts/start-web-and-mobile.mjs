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
const webDir = path.join(projectRoot, 'apps', 'web');
const isWindows = process.platform === 'win32';
const metroPort = 8081;
const webPort = 3000;
const args = new Set(process.argv.slice(2));
const enableDevClient = args.has('--dev-client');
const enableAndroidBuild = args.has('--android-build');
const targetOs = (() => {
  if (args.has('--windows')) {
    return 'windows';
  }
  if (args.has('--posix')) {
    return 'posix';
  }
  return null;
})();

const children = [];
let isShuttingDown = false;
let shutdownPromise = null;

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
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

function resolveAdbPath() {
  if (!isWindows) {
    return 'adb';
  }

  const winGetRoot = path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');

  try {
    const candidate = readdirSync(winGetRoot)
      .filter((name) => name.startsWith('Google.PlatformTools_'))
      .map((name) => path.join(winGetRoot, name, 'platform-tools', 'adb.exe'))
      .find((adbPath) => adbPath);

    if (candidate) {
      return candidate;
    }
  } catch {
    // Fall back to adb from PATH.
  }

  return 'adb';
}

function validateTargetOs() {
  if (targetOs === 'windows' && !isWindows) {
    throw new Error('This all-in-one command is for Windows only. Use the Linux/macOS variant on this OS.');
  }

  if (targetOs === 'posix' && isWindows) {
    throw new Error('This all-in-one command is for Linux/macOS only. Use the Windows variant on this OS.');
  }
}

async function setupUsbBridgeAndLaunchApp() {
  if (enableDevClient) {
    return;
  }

  const adb = resolveAdbPath();

  try {
    await Promise.all([waitForPort(webPort), waitForPort(metroPort)]);
  } catch (error) {
    console.warn(`[dev:all] Skipping Expo Go launch: ${error.message}`);
    return;
  }

  await sleep(1000);

  console.log('[dev:all] Configuring adb reverse for ports 8081 and 3000');

  const devicesResult = runCommand(adb, ['devices']);
  if (devicesResult.status !== 0) {
    console.warn(`[dev:all] adb devices failed: ${devicesResult.stderr.trim() || devicesResult.stdout.trim()}`);
    return;
  }

  const deviceLines = devicesResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'));

  const hasReadyDevice = deviceLines.some((line) => /\sdevice$/.test(line));

  if (!hasReadyDevice) {
    console.warn('[dev:all] No Android device in `device` state detected. Skipping Expo Go launch.');
    return;
  }

  // Force stop Expo Go to clear any stale state/routes
  console.log('[dev:all] Clearing Expo Go state to ensure clean start');
  const forceStopResult = runCommand(adb, ['shell', 'am', 'force-stop', 'host.exp.exponent']);
  if (forceStopResult.status !== 0) {
    console.warn(`[dev:all] Warning: Failed to force-stop Expo Go: ${forceStopResult.stderr.trim() || forceStopResult.stdout.trim()}`);
  }

  await sleep(500);

  for (const port of [metroPort, webPort]) {
    const reverseResult = runCommand(adb, ['reverse', `tcp:${port}`, `tcp:${port}`]);
    if (reverseResult.status !== 0) {
      console.warn(`[dev:all] adb reverse for port ${port} failed: ${reverseResult.stderr.trim() || reverseResult.stdout.trim()}`);
    }
  }

  const launchResult = runCommand(adb, [
    'shell',
    'am',
    'start',
    '-S',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `exp://127.0.0.1:${metroPort}/--/`,
    'host.exp.exponent',
  ]);

  if (launchResult.status !== 0) {
    console.warn(`[dev:all] Failed to launch Expo Go: ${launchResult.stderr.trim() || launchResult.stdout.trim()}`);
    return;
  }

  console.log('[dev:all] Expo Go launched over USB with clean state.');
}

async function buildAndroidDevClient() {
  console.log('[dev:all] Building and launching Android dev client over USB');

  const command = isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm';
  const commandArgs = isWindows
    ? ['/d', '/s', '/c', 'pnpm', 'mobile:dev-client:android:usb']
    : ['mobile:dev-client:android:usb'];

  const result = await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve({ code: code ?? 0, signal });
    });
  });

  if (result.signal) {
    throw new Error(`Android dev client build was interrupted by signal ${result.signal}.`);
  }

  if (result.code !== 0) {
    throw new Error(`Android dev client build failed with exit code ${result.code}.`);
  }

  console.log('[dev:all] Android dev client build finished.');
}

function startProcess(name, args) {
  console.log(`[dev:all] Starting ${name}: pnpm ${args.join(' ')}`);

  const command = isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm';
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'pnpm', ...args] : args;

  const child = spawn(command, commandArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  children.push({ name, child });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    if (signal) {
      console.log(`[dev:all] ${name} exited with signal ${signal}. Stopping the remaining process.`);
    } else {
      console.log(`[dev:all] ${name} exited with code ${code ?? 0}. Stopping the remaining process.`);
    }

    void shutdown(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[dev:all] Failed to start ${name}: ${error.message}`);
    void shutdown(1);
  });
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
        console.warn(`[dev:all] Failed to stop ${name} (PID ${child.pid}): ${error.message}`);
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
  validateTargetOs();
  await ensureWebPortReady();

  startProcess('web', ['--filter', 'field-service-web', 'dev']);
  startProcess('mobile', [
    enableDevClient ? 'mobile:metro:dev-client:usb' : 'mobile:metro:usb',
  ]);

  const postStartTask = enableAndroidBuild
    ? buildAndroidDevClient
    : setupUsbBridgeAndLaunchApp;

  postStartTask().catch((error) => {
    console.warn(`[dev:all] USB setup skipped: ${error.message}`);
    if (enableAndroidBuild) {
      void shutdown(1);
    }
  });
}

main().catch((error) => {
  console.error(`[dev:all] ${error.message}`);
  void shutdown(1);
});
