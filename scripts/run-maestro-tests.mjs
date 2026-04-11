#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const maestroDir = path.join(projectRoot, 'e2e', 'maestro');
const webDir = path.join(projectRoot, 'apps', 'web');
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const metroPort = 8081;
const webPort = 3000;
const mobileAppId = 'com.fieldservicemonorepo';
const expoGoAppId = 'host.exp.exponent';

let devAllProcess = null;
let maestroCommand = null;
let maestroSource = null;
let resolvedAdbPath = null;
let resolvedMaestroDeviceId = null;

function runCommand(command, args, options = {}) {
  const extension = path.extname(command).toLowerCase();
  const isWindowsScript = isWindows && (extension === '.cmd' || extension === '.bat');

  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: isWindowsScript,
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

function resolveExecutableFromPath(name) {
  const lookup = isWindows ? runCommand('where.exe', [name]) : runCommand('which', [name]);

  if (lookup.status !== 0) {
    return null;
  }

  const resolved = lookup.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return resolved || null;
}

function getCandidateMaestroPaths() {
  const homeDir = os.homedir();
  const userProfile = process.env.USERPROFILE || homeDir;
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  if (isWindows) {
    return [
      path.join(userProfile, 'scoop', 'shims', 'maestro.cmd'),
      path.join(userProfile, 'scoop', 'shims', 'maestro.exe'),
      path.join(userProfile, '.maestro', 'bin', 'maestro.cmd'),
      path.join(userProfile, '.maestro', 'bin', 'maestro.exe'),
      path.join(localAppData, 'Programs', 'Maestro', 'bin', 'maestro.cmd'),
      path.join(localAppData, 'Programs', 'Maestro', 'bin', 'maestro.exe'),
      path.join(programFiles, 'Maestro', 'bin', 'maestro.cmd'),
      path.join(programFiles, 'Maestro', 'bin', 'maestro.exe'),
    ];
  }

  if (isMac) {
    return [
      path.join(homeDir, '.maestro', 'bin', 'maestro'),
      '/opt/homebrew/bin/maestro',
      '/usr/local/bin/maestro',
      '/usr/bin/maestro',
    ];
  }

  if (isLinux) {
    return [
      path.join(homeDir, '.maestro', 'bin', 'maestro'),
      '/usr/local/bin/maestro',
      '/usr/bin/maestro',
    ];
  }

  return [];
}

function verifyMaestroCommand(command) {
  const result =
    isWindows && path.extname(command).toLowerCase() === '.cmd'
      ? runPowerShell(`& "${command}" --version`)
      : runCommand(command, ['--version'], { stdio: 'pipe' });

  if (result.error || result.status !== 0) {
    return null;
  }

  const version = `${result.stdout ?? ''}`.trim();
  return version || 'unknown';
}

function getAdbCandidatePaths() {
  const homeDir = os.homedir();
  const userProfile = process.env.USERPROFILE || homeDir;
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  if (isWindows) {
    return [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe', 'platform-tools', 'adb.exe'),
      path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(userProfile, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(programFiles, 'Android', 'Android Studio', 'platform-tools', 'adb.exe'),
    ];
  }

  return ['/usr/local/bin/adb', '/usr/bin/adb', path.join(homeDir, 'Android', 'Sdk', 'platform-tools', 'adb')];
}

function resolveAdbPath() {
  const fromPath = resolveExecutableFromPath('adb');
  if (fromPath) {
    return fromPath;
  }

  for (const candidate of getAdbCandidatePaths()) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getConnectedAndroidDevices(adbPath) {
  const result = runCommand(adbPath, ['devices']);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'adb devices failed.');
  }

  return `${result.stdout ?? ''}`
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    })
    .filter((device) => device.serial && device.state === 'device');
}

function resolveAndroidDeviceId(adbPath) {
  const explicitDeviceId = getMaestroDeviceId();
  if (explicitDeviceId) {
    return explicitDeviceId;
  }

  const devices = getConnectedAndroidDevices(adbPath);
  if (devices.length === 1) {
    return devices[0].serial;
  }

  if (devices.length === 0) {
    throw new Error('No Android device detected via adb.');
  }

  throw new Error(`Multiple Android devices detected (${devices.map((device) => device.serial).join(', ')}). Set ANDROID_SERIAL or MAESTRO_DEVICE_ID.`);
}

function isPackageInstalled(adbPath, deviceId, packageName) {
  const result = runCommand(adbPath, ['-s', deviceId, 'shell', 'pm', 'path', packageName]);
  return result.status === 0 && /package:/i.test(result.stdout ?? '');
}

function configureAdbReverse(adbPath, deviceId) {
  for (const port of [metroPort, webPort]) {
    const result = runCommand(adbPath, ['-s', deviceId, 'reverse', `tcp:${port}`, `tcp:${port}`]);

    if (result.status !== 0) {
      throw new Error(
        `Failed to configure adb reverse for port ${port}: ${result.stderr.trim() || result.stdout.trim() || 'unknown error'}`
      );
    }
  }
}

function launchTargetApp(adbPath, deviceId) {
  if (isPackageInstalled(adbPath, deviceId, mobileAppId)) {
    console.log(`[Maestro E2E] Launching installed app ${mobileAppId} on ${deviceId}.`);
    const result = runCommand(adbPath, [
      '-s',
      deviceId,
      'shell',
      'monkey',
      '-p',
      mobileAppId,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);

    if (result.status !== 0) {
      throw new Error(`Failed to launch installed app ${mobileAppId}.`);
    }

    return mobileAppId;
  }

  if (isPackageInstalled(adbPath, deviceId, expoGoAppId)) {
    console.log(`[Maestro E2E] Launching Expo Go on ${deviceId} via exp://127.0.0.1:${metroPort}.`);
    const result = runCommand(adbPath, [
      '-s',
      deviceId,
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      `exp://127.0.0.1:${metroPort}`,
      expoGoAppId,
    ]);

    if (result.status !== 0) {
      throw new Error('Failed to launch Expo Go via adb.');
    }

    return expoGoAppId;
  }

  throw new Error(
    `Neither ${mobileAppId} nor ${expoGoAppId} is installed on ${deviceId}. Install the debug app or Expo Go first.`
  );
}

function findMaestroCommand() {
  const explicitCommand = process.env.MAESTRO_BIN?.trim();
  if (explicitCommand) {
    const version = verifyMaestroCommand(explicitCommand);
    if (version) {
      maestroSource = 'MAESTRO_BIN';
      return { command: explicitCommand, version };
    }

    throw new Error(`MAESTRO_BIN is set but not executable: ${explicitCommand}`);
  }

  const resolvedFromPath = resolveExecutableFromPath('maestro');
  if (resolvedFromPath) {
    const version = verifyMaestroCommand(resolvedFromPath);
    if (version) {
      maestroSource = 'PATH';
      return { command: resolvedFromPath, version };
    }
  }

  for (const candidate of getCandidateMaestroPaths()) {
    if (!candidate || !existsSync(candidate)) {
      continue;
    }

    const version = verifyMaestroCommand(candidate);
    if (version) {
      maestroSource = 'auto-discovery';
      return { command: candidate, version };
    }
  }

  return null;
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
  const maestroInfo = findMaestroCommand();

  if (!maestroInfo) {
    console.error('Error: Maestro CLI is not installed or not in PATH.');
    console.error('Install Maestro so that `maestro` is available on PATH, or set MAESTRO_BIN to the executable path.');
    process.exit(1);
  }

  maestroCommand = maestroInfo.command;
  console.log(`Maestro CLI version: ${maestroInfo.version}`);
  console.log(`[Maestro] Resolved via ${maestroSource}.`);
}

function printCommandOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function explainMaestroFailure(result) {
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (/INSTALL_FAILED_USER_RESTRICTED/i.test(combinedOutput)) {
    console.error('\n[Maestro E2E] Android blocked installation of the Maestro helper APK.');
    console.error('[Maestro E2E] This is a device policy / confirmation issue, not an app code issue.');
    console.error('[Maestro E2E] Required on the Android device/emulator:');
    console.error('- confirm the install prompt if it is shown on screen');
    console.error('- enable developer option "Install via USB" if the device requires it');
    console.error('- allow USB debugging for this computer');
    console.error('- on managed/work-profile devices, allow adb installs or use an unrestricted emulator');
  }
}

function getMaestroFlowFiles() {
  return readdirSync(maestroDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.yaml'))
    .sort()
    .map((fileName) => path.join(maestroDir, fileName));
}

function getMaestroDeviceId() {
  return process.env.MAESTRO_DEVICE_ID?.trim() || process.env.ANDROID_SERIAL?.trim() || null;
}

function shouldReinstallMaestroDriver() {
  return /^(1|true|yes)$/i.test(process.env.MAESTRO_REINSTALL_DRIVER ?? '');
}

function isWirelessAdbDevice(deviceId) {
  if (!deviceId) {
    return false;
  }

  // Example wireless id: adb-xxxxxx._adb-tls-connect._tcp
  return /adb-tls-connect|_tcp|:\d+$/i.test(deviceId);
}

function flowUsesAirplaneMode(flowFile) {
  try {
    const content = readFileSync(flowFile, 'utf8');
    return /\bsetAirplaneMode\s*:/m.test(content);
  } catch {
    return false;
  }
}

async function runMaestroTests() {
  checkMaestroInstallation();
  const adbPath = resolveAdbPath();
  const maestroDeviceId = adbPath ? resolveAndroidDeviceId(adbPath) : getMaestroDeviceId();
  resolvedAdbPath = adbPath;
  resolvedMaestroDeviceId = maestroDeviceId;

  console.log('[Maestro E2E] Starting dev:all process...');
  devAllProcess = spawn('pnpm', ['run', 'dev:all'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
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
  console.log(`Using Maestro command: ${maestroCommand}`);
  console.log(`Target appId: ${mobileAppId}`);

  const flowFiles = getMaestroFlowFiles();
  if (flowFiles.length === 0) {
    console.error(`No Maestro flow files found in ${maestroDir}.`);
    shutdown(1);
    return;
  }

  console.log(`Discovered ${flowFiles.length} Maestro flow file(s):`);
  for (const flowFile of flowFiles) {
    console.log(`- ${path.basename(flowFile)}`);
  }

  const reinstallDriver = shouldReinstallMaestroDriver();
  if (maestroDeviceId) {
    console.log(`Target device: ${maestroDeviceId}`);
  }
  if (adbPath) {
    console.log(`adb: ${adbPath}`);
  }
  console.log(`Reinstall Maestro driver: ${reinstallDriver ? 'yes' : 'no'}`);

  for (const flowFile of flowFiles) {
    console.log(`\n[Maestro E2E] Running flow: ${path.basename(flowFile)}`);

    if (isWirelessAdbDevice(maestroDeviceId) && flowUsesAirplaneMode(flowFile)) {
      console.warn(
        `[Maestro E2E] Skipping ${path.basename(flowFile)}: flow uses setAirplaneMode and the device is connected over Wi-Fi ADB (${maestroDeviceId}), which disconnects the session.`
      );
      continue;
    }

    if (adbPath && maestroDeviceId) {
      configureAdbReverse(adbPath, maestroDeviceId);
      launchTargetApp(adbPath, maestroDeviceId);
      await sleep(5000);
    }

    const maestroArgs = ['test'];
    if (maestroDeviceId) {
      maestroArgs.push('--device', maestroDeviceId);
    }
    if (!reinstallDriver) {
      maestroArgs.push('--no-reinstall-driver');
    }
    maestroArgs.push(flowFile);

    const maestroResult = runCommand(maestroCommand, maestroArgs);
    printCommandOutput(maestroResult);

    if (maestroResult.status !== 0) {
      explainMaestroFailure(maestroResult);
      console.error(`[Maestro E2E] Flow failed: ${path.basename(flowFile)} (exit code ${maestroResult.status})`);
      shutdown(maestroResult.status);
      return;
    }
  }

  console.log('Maestro tests completed successfully.');
  shutdown(0);
}

function shutdown(exitCode = 0) {
  if (devAllProcess && !devAllProcess.killed) {
    console.log('[Maestro E2E] Shutting down dev:all process...');
    killProcessTree(devAllProcess.pid);
  }

  if (resolvedAdbPath && resolvedMaestroDeviceId) {
    for (const packageName of [expoGoAppId, mobileAppId]) {
      runCommand(resolvedAdbPath, ['-s', resolvedMaestroDeviceId, 'shell', 'am', 'force-stop', packageName]);
    }
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

runMaestroTests().catch((error) => {
  console.error('An unexpected error occurred:', error);
  shutdown(1);
});
