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

function getConnectedDevices(adbPath) {
  const result = runCommand(adbPath, ['devices']);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'adb devices failed');
  }

  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/))
    .filter(parts => parts[1] === 'device')
    .map(parts => parts[0]);
}

function isPackageInstalled(adbPath, serial, packageName) {
  const result = runCommand(adbPath, ['-s', serial, 'shell', 'pm', 'path', packageName]);
  return result.status === 0 && result.stdout.includes('package:');
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

  try {
    devices = getConnectedDevices(adbPath);
  } catch (error) {
    console.warn(
      `Android app data reset skipped: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  if (devices.length === 0) {
    console.log(
      'Android app data reset skipped: no connected Android device/emulator detected.'
    );
    return;
  }

  console.log(`Resetting Android app data on ${devices.length} device(s)...`);

  for (const serial of devices) {
    console.log(`- Device ${serial}`);

    for (const packageName of [DEV_CLIENT_PACKAGE, EXPO_GO_PACKAGE]) {
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
