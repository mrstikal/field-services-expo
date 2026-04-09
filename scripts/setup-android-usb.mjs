#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function resolveAdbPath() {
  if (process.platform !== 'win32') {
    return 'adb';
  }

  const winGetRoot = path.join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft',
    'WinGet',
    'Packages'
  );

  try {
    const candidate = readdirSync(winGetRoot)
      .filter((name) => name.startsWith('Google.PlatformTools_'))
      .map((name) =>
        path.join(winGetRoot, name, 'platform-tools', 'adb.exe')
      )
      .find(Boolean);

    if (candidate) {
      return candidate;
    }
  } catch {
    // Fall back to PATH lookup below.
  }

  const sdkCandidates = [
    path.join(
      process.env.LOCALAPPDATA ?? '',
      'Android',
      'Sdk',
      'platform-tools',
      'adb.exe'
    ),
    path.join('C:\\ADB', 'platform-tools', 'adb.exe'),
    path.join(process.env.ANDROID_HOME ?? '', 'platform-tools', 'adb.exe'),
    path.join(process.env.ANDROID_SDK_ROOT ?? '', 'platform-tools', 'adb.exe'),
  ].filter((candidate) => candidate && candidate !== 'platform-tools\\adb.exe');

  const existingCandidate = sdkCandidates.find((candidate) =>
    existsSync(candidate)
  );

  return existingCandidate ?? 'adb';
}

function ensureSuccess(result, context) {
  if (result.status === 0) {
    return;
  }

  const details = result.stderr.trim() || result.stdout.trim() || 'Unknown error.';
  console.error(`[android:usb] ${context} failed: ${details}`);
  process.exit(result.status ?? 1);
}

const adb = resolveAdbPath();

console.log(`[android:usb] Using adb: ${adb}`);

const devicesResult = runCommand(adb, ['devices']);
ensureSuccess(devicesResult, 'adb devices');

const deviceLines = devicesResult.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('List of devices attached'));

const readyDevices = deviceLines.filter((line) => /\sdevice$/.test(line));

if (readyDevices.length === 0) {
  console.error(
    '[android:usb] No Android device in `device` state detected. Connect the phone over USB and enable USB debugging.'
  );
  process.exit(1);
}

console.log(`[android:usb] Connected device(s): ${readyDevices.join(', ')}`);

for (const port of [8081, 3000]) {
  const reverseResult = runCommand(adb, [
    'reverse',
    `tcp:${port}`,
    `tcp:${port}`,
  ]);
  ensureSuccess(reverseResult, `adb reverse for port ${port}`);
}

const reverseListResult = runCommand(adb, ['reverse', '--list']);
ensureSuccess(reverseListResult, 'adb reverse --list');

console.log('[android:usb] Active reverse mappings:');
console.log(reverseListResult.stdout.trim() || '(none)');
