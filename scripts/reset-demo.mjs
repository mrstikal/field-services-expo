#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const DEV_CLIENT_PACKAGE = 'cz.fieldservice.app';
const EXPO_GO_PACKAGE = 'host.exp.exponent';

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });
}

function resolveAdbPath() {
  const fromPath = runCommand(isWindows ? 'where' : 'which', ['adb']);
  if (fromPath.status === 0) {
    const candidate = fromPath.stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean);

    if (candidate) {
      return candidate;
    }
  }

  const candidates = isWindows
    ? [
        path.join(
          process.env.LOCALAPPDATA ?? '',
          'Android',
          'Sdk',
          'platform-tools',
          'adb.exe'
        ),
        path.join(
          process.env.USERPROFILE ?? '',
          'AppData',
          'Local',
          'Android',
          'Sdk',
          'platform-tools',
          'adb.exe'
        ),
        path.join(
          process.env.ProgramFiles ?? '',
          'Android',
          'Android Studio',
          'platform-tools',
          'adb.exe'
        ),
        path.join(
          process.env.LOCALAPPDATA ?? '',
          'Microsoft',
          'WinGet',
          'Packages',
          'Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe',
          'platform-tools',
          'adb.exe'
        ),
      ]
    : [
        path.join(process.env.ANDROID_HOME ?? '', 'platform-tools', 'adb'),
        path.join(process.env.ANDROID_SDK_ROOT ?? '', 'platform-tools', 'adb'),
        path.join(process.env.HOME ?? '', 'Android', 'Sdk', 'platform-tools', 'adb'),
        '/usr/local/bin/adb',
        '/usr/bin/adb',
      ];

  return candidates.find(candidate => candidate && existsSync(candidate)) ?? null;
}

function getDeviceStates(adbPath) {
  const result = runCommand(adbPath, ['devices']);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'adb devices failed');
  }

  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [serial = '', state = 'unknown'] = line.split(/\s+/);
      return { serial, state };
    })
    .filter(entry => entry.serial);
}

function startAdbServer(adbPath) {
  const result = runCommand(adbPath, ['start-server']);
  return result.status === 0;
}

function getMdnsConnectEndpoints(adbPath) {
  const result = runCommand(adbPath, ['mdns', 'services']);

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.includes('_adb-tls-connect._tcp'))
    .map(line => {
      const tokens = line.split(/\s+/);
      return tokens.find(token => /:\d+$/.test(token)) ?? '';
    })
    .filter(Boolean);
}

function autoConnectDevices(adbPath) {
  startAdbServer(adbPath);
  const endpoints = getMdnsConnectEndpoints(adbPath);

  if (endpoints.length === 0) {
    return 0;
  }

  let connected = 0;

  for (const endpoint of endpoints) {
    const result = runCommand(adbPath, ['connect', endpoint]);
    const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (result.status === 0 || output.includes('already connected')) {
      connected += 1;
    }
  }

  return connected;
}

function isPackageInstalled(adbPath, serial, packageName) {
  const result = runCommand(adbPath, ['-s', serial, 'shell', 'pm', 'path', packageName]);
  return result.status === 0 && result.stdout.includes('package:');
}

function getInstalledPackages(adbPath, serial) {
  const result = runCommand(adbPath, ['-s', serial, 'shell', 'pm', 'list', 'packages']);

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || result.stdout.trim() || 'pm list packages failed'
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^package:/, '').trim())
    .filter(Boolean);
}

function getPackagesToClear(installedPackages) {
  const prefixes = [DEV_CLIENT_PACKAGE, EXPO_GO_PACKAGE];
  return installedPackages.filter(packageName =>
    prefixes.some(prefix => packageName === prefix || packageName.startsWith(`${prefix}.`))
  );
}

function clearPackageData(adbPath, serial, packageName) {
  const result = runCommand(adbPath, ['-s', serial, 'shell', 'pm', 'clear', packageName]);

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || result.stdout.trim() || `pm clear ${packageName} failed`
    );
  }

  return result.stdout.trim();
}

function resetAndroidAppData() {
  const adbPath = resolveAdbPath();

  if (!adbPath) {
    console.log(
      'Android app data reset skipped: adb was not found. Supabase demo data was still reset.'
    );
    return;
  }

  let devices = [];
  let deviceStates = [];

  try {
    deviceStates = getDeviceStates(adbPath);
    devices = deviceStates
      .filter(entry => entry.state === 'device')
      .map(entry => entry.serial);
  } catch (error) {
    console.warn(
      `Android app data reset skipped: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  if (devices.length === 0) {
    const autoConnectedCount = autoConnectDevices(adbPath);

    if (autoConnectedCount > 0) {
      try {
        deviceStates = getDeviceStates(adbPath);
        devices = deviceStates
          .filter(entry => entry.state === 'device')
          .map(entry => entry.serial);
      } catch (error) {
        console.warn(
          `Android app data reset skipped: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }
    }
  }

  if (devices.length === 0) {
    const notReady = deviceStates.filter(entry => entry.state !== 'device');
    if (notReady.length > 0) {
      const details = notReady.map(entry => `${entry.serial} (${entry.state})`).join(', ');
      console.log(`Android device(s) detected but not ready for adb commands: ${details}`);
    }
    console.log(
      'Android app data reset skipped: no connected Android device/emulator detected.'
    );
    console.log(
      'Tip: pair once via "adb pair <IP:PORT>" and keep Wireless debugging enabled; next resets should reconnect automatically.'
    );
    return;
  }

  console.log(`Resetting Android app data on ${devices.length} device(s)...`);

  for (const serial of devices) {
    console.log(`- Device ${serial}`);
    let packagesToClear = [];

    try {
      const installedPackages = getInstalledPackages(adbPath, serial);
      packagesToClear = getPackagesToClear(installedPackages);
    } catch (error) {
      console.warn(
        `  - failed to list installed packages (${error instanceof Error ? error.message : String(error)})`
      );
      continue;
    }

    if (packagesToClear.length === 0) {
      console.log(
        `  - no matching app packages found (looked for ${DEV_CLIENT_PACKAGE}* and ${EXPO_GO_PACKAGE}*)`
      );
      continue;
    }

    for (const packageName of packagesToClear) {
      if (!isPackageInstalled(adbPath, serial, packageName)) {
        console.log(`  - ${packageName}: not installed, skipping`);
        continue;
      }

      try {
        const output = clearPackageData(adbPath, serial, packageName);
        console.log(`  - ${packageName}: ${output}`);
      } catch (error) {
        console.warn(
          `  - ${packageName}: failed to clear app data (${error instanceof Error ? error.message : String(error)})`
        );
      }
    }
  }

  console.log('Android app data reset complete.\n');
}

function main() {
  const supabaseReset = runCommand(process.execPath, [path.join(process.cwd(), 'scripts', 'reset-supabase.mjs')], {
    stdio: 'inherit',
  });

  if (supabaseReset.status !== 0) {
    process.exit(supabaseReset.status ?? 1);
  }

  console.log('');
  resetAndroidAppData();
}

main();
