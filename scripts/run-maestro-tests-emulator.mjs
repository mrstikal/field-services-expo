#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const appId = 'com.fieldservicemonorepo';
const bootTimeoutMs = 180_000;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitLines(value) {
  return `${value ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function commonSdkRoots() {
  const homeDir = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || '';

  return [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    isWindows ? path.join(localAppData, 'Android', 'Sdk') : null,
    isMac ? path.join(homeDir, 'Library', 'Android', 'sdk') : path.join(homeDir, 'Android', 'Sdk'),
  ].filter(Boolean);
}

function getWindowsToolCandidates(fallbackName) {
  const homeDir = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || homeDir;
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  if (fallbackName === 'adb') {
    return [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe', 'platform-tools', 'adb.exe'),
      path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(userProfile, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(programFiles, 'Android', 'Android Studio', 'platform-tools', 'adb.exe'),
    ];
  }

  if (fallbackName === 'emulator') {
    return [
      path.join(localAppData, 'Android', 'Sdk', 'emulator', 'emulator.exe'),
      path.join(userProfile, 'AppData', 'Local', 'Android', 'Sdk', 'emulator', 'emulator.exe'),
      path.join(programFiles, 'Android', 'Android Studio', 'emulator', 'emulator.exe'),
    ];
  }

  return [];
}

function resolveFromPath(name) {
  const lookup = isWindows ? runCommand('where.exe', [name]) : runCommand('which', [name]);
  if (lookup.status !== 0) {
    return null;
  }

  return splitLines(lookup.stdout)[0] ?? null;
}

function resolveSdkTool(relativePath, fallbackName) {
  for (const sdkRoot of commonSdkRoots()) {
    const candidate = path.join(sdkRoot, relativePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (isWindows) {
    for (const candidate of getWindowsToolCandidates(fallbackName)) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const fromPath = resolveFromPath(fallbackName);
  if (fromPath) {
    return fromPath;
  }

  if (fallbackName === 'adb') {
    throw new Error(
      'Unable to resolve adb. Install Android Platform Tools or set ANDROID_SDK_ROOT/ANDROID_HOME to an SDK containing platform-tools.'
    );
  }

  if (fallbackName === 'emulator') {
    throw new Error(
      'Unable to resolve emulator. Install the Android Emulator + an AVD in Android Studio, or set ANDROID_SDK_ROOT/ANDROID_HOME to an SDK containing emulator.'
    );
  }

  throw new Error(`Unable to resolve ${fallbackName}. Set ANDROID_SDK_ROOT/ANDROID_HOME or add ${fallbackName} to PATH.`);
}

function getAdbPath() {
  return resolveSdkTool(path.join('platform-tools', isWindows ? 'adb.exe' : 'adb'), 'adb');
}

function getEmulatorPath() {
  return resolveSdkTool(path.join('emulator', isWindows ? 'emulator.exe' : 'emulator'), 'emulator');
}

function getAndroidDevices(adbPath) {
  const result = runCommand(adbPath, ['devices']);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'adb devices failed.');
  }

  return splitLines(result.stdout)
    .slice(1)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    })
    .filter((device) => device.serial && device.state);
}

function getRunningEmulatorSerial(adbPath) {
  return (
    getAndroidDevices(adbPath).find((device) => device.serial.startsWith('emulator-') && device.state === 'device')?.serial ??
    null
  );
}

function listAvds(emulatorPath) {
  const result = runCommand(emulatorPath, ['-list-avds']);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'Failed to list Android AVDs.');
  }

  return splitLines(result.stdout);
}

function resolveAvdName(emulatorPath) {
  const explicitAvd = process.env.ANDROID_AVD_NAME?.trim();
  if (explicitAvd) {
    return explicitAvd;
  }

  const avds = listAvds(emulatorPath);
  if (avds.length === 1) {
    return avds[0];
  }

  if (avds.length === 0) {
    throw new Error('No Android AVD found. Create an emulator first or set ANDROID_AVD_NAME.');
  }

  throw new Error(`Multiple Android AVDs found (${avds.join(', ')}). Set ANDROID_AVD_NAME to choose one.`);
}

function startEmulator(emulatorPath, avdName) {
  const extraArgs = splitLines((process.env.ANDROID_EMULATOR_ARGS || '').replace(/\s+/g, '\n'));
  const args = ['-avd', avdName, ...extraArgs];

  console.log(`[Android Emulator] Starting AVD: ${avdName}`);
  const child = spawn(emulatorPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

async function waitForEmulatorDevice(adbPath) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < bootTimeoutMs) {
    const serial = getRunningEmulatorSerial(adbPath);
    if (serial) {
      return serial;
    }

    await sleep(2000);
  }

  throw new Error('Timed out waiting for Android emulator to appear in `adb devices`.');
}

async function waitForBootCompleted(adbPath, serial) {
  const startedAt = Date.now();

  runCommand(adbPath, ['-s', serial, 'wait-for-device']);

  while (Date.now() - startedAt < bootTimeoutMs) {
    const result = runCommand(adbPath, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed']);
    const bootCompleted = `${result.stdout ?? ''}`.trim();

    if (result.status === 0 && bootCompleted === '1') {
      runCommand(adbPath, ['-s', serial, 'shell', 'input', 'keyevent', '82']);
      return;
    }

    await sleep(3000);
  }

  throw new Error(`Timed out waiting for emulator ${serial} to finish booting.`);
}

function isAppInstalled(adbPath, serial, packageName) {
  const result = runCommand(adbPath, ['-s', serial, 'shell', 'pm', 'path', packageName]);
  return result.status === 0 && /package:/i.test(result.stdout);
}

function ensureAppInstalled(adbPath, serial) {
  const forceInstall = /^(1|true|yes)$/i.test(process.env.E2E_ANDROID_INSTALL_APP ?? '');
  if (!forceInstall && isAppInstalled(adbPath, serial, appId)) {
    console.log(`[Android Emulator] App ${appId} is already installed on ${serial}.`);
    return;
  }

  console.log(`[Android Emulator] Installing app ${appId} on ${serial} via Expo Android run...`);
  const result = runCommand(
    'pnpm',
    ['--filter', 'field-service-mobile', 'android'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: '1',
        ANDROID_SERIAL: serial,
      },
      shell: isWindows,
    }
  );

  if (result.status !== 0) {
    throw new Error('Failed to install the mobile app onto the Android emulator.');
  }
}

function runMaestroOnEmulator(serial) {
  const result = runCommand(
    process.execPath,
    [path.join(projectRoot, 'scripts', 'run-maestro-tests.mjs')],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ANDROID_SERIAL: serial,
        MAESTRO_DEVICE_ID: serial,
      },
    }
  );

  process.exit(result.status ?? 1);
}

async function main() {
  const adbPath = getAdbPath();
  const emulatorPath = getEmulatorPath();

  console.log(`[Android Emulator] adb: ${adbPath}`);
  console.log(`[Android Emulator] emulator: ${emulatorPath}`);

  let serial = getRunningEmulatorSerial(adbPath);
  if (!serial) {
    const avdName = resolveAvdName(emulatorPath);
    startEmulator(emulatorPath, avdName);
    serial = await waitForEmulatorDevice(adbPath);
  } else {
    console.log(`[Android Emulator] Using already running emulator: ${serial}`);
  }

  await waitForBootCompleted(adbPath, serial);
  console.log(`[Android Emulator] Boot completed: ${serial}`);

  ensureAppInstalled(adbPath, serial);
  runMaestroOnEmulator(serial);
}

main().catch((error) => {
  console.error(`[Android Emulator] ${error.message}`);
  process.exit(1);
});
