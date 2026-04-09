#!/usr/bin/env node
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const androidDir = path.join(projectRoot, 'apps', 'mobile', 'android');
const isWindows = process.platform === 'win32';
const enableDevClient = process.argv.includes('--dev-client');
const metroPort = 8081;

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
}

function resolveAdbPath() {
  if (!isWindows) {
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
      .map((name) => path.join(winGetRoot, name, 'platform-tools', 'adb.exe'))
      .find((adbPath) => existsSync(adbPath));

    if (candidate) {
      return candidate;
    }
  } catch {
    // Fall back to other known locations.
  }

  const candidates = [
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
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? 'adb';
}

function resolveAndroidSdkPath() {
  const envCandidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
  ].filter(Boolean);

  const defaultCandidates = [
    path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
    'C:\\Android\\Sdk',
    'D:\\Android\\Sdk',
    'E:\\Android\\Sdk',
  ];

  const candidates = [...envCandidates, ...defaultCandidates];

  return (
    candidates.find((candidate) => {
      if (!candidate || !existsSync(candidate)) {
        return false;
      }

      return (
        existsSync(path.join(candidate, 'platform-tools')) &&
        existsSync(path.join(candidate, 'platforms'))
      );
    }) ?? null
  );
}

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

function writeAndroidLocalProperties(sdkPath) {
  const localPropertiesPath = path.join(androidDir, 'local.properties');
  const normalizedSdkPath = isWindows
    ? sdkPath.replace(/\\/g, '\\\\')
    : sdkPath;

  writeFileSync(
    localPropertiesPath,
    `sdk.dir=${normalizedSdkPath}\n`,
    'utf8'
  );
}

function clearAndroidAutolinkingCache() {
  const autolinkingCacheDir = path.join(androidDir, 'build', 'generated', 'autolinking');

  if (!existsSync(autolinkingCacheDir)) {
    return;
  }

  rmSync(autolinkingCacheDir, { recursive: true, force: true });
  console.log(
    `[mobile:android:usb] Cleared stale autolinking cache: ${autolinkingCacheDir}`
  );
}

function removeDirIfExists(targetPath, label) {
  if (!existsSync(targetPath)) {
    return;
  }

  rmSync(targetPath, { recursive: true, force: true });
  console.log(`[mobile:android:usb] Cleared ${label}: ${targetPath}`);
}

function clearNativeAndroidBuildCaches() {
  removeDirIfExists(path.join(androidDir, '.cxx'), 'Android NDK/CMake cache');
  removeDirIfExists(path.join(androidDir, 'app', 'build'), 'Android app build cache');
  removeDirIfExists(path.join(androidDir, 'build'), 'Android project build cache');
  removeDirIfExists(
    path.join(projectRoot, 'apps', 'mobile', 'node_modules', 'react-native-screens', 'android', 'build'),
    'react-native-screens Android build cache'
  );
}

function uninstallAndroidAppIfPresent(adbPath, env) {
  const packageName = 'cz.fieldservice.app';
  const result = runCommand(adbPath, ['uninstall', packageName], {
    env,
  });

  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();

  if ((result.status ?? 0) === 0) {
    console.log(`[mobile:android:usb] Uninstalled existing Android app: ${packageName}`);
    return;
  }

  if (/unknown package|not installed/i.test(combinedOutput)) {
    return;
  }

  console.warn(
    `[mobile:android:usb] Failed to uninstall ${packageName} before rebuild: ${combinedOutput}`
  );
}

function runPnpm(args, options = {}) {
  const command = isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm';
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'pnpm', ...args] : args;

  const result = runCommand(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    fail(
      `[mobile:android:usb] Failed to start pnpm ${args.join(' ')}: ${result.error.message}`
    );
  }

  return result;
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

async function isMetroAlreadyRunning() {
  const isPortAvailable = await checkPortAvailable(metroPort);
  return !isPortAvailable;
}

async function main() {
  const sdkPath = resolveAndroidSdkPath();

  if (!sdkPath) {
    fail(
      [
        '[mobile:android:usb] Android SDK was not found.',
        '[mobile:android:usb] Install Android Studio and Android SDK, then set one of:',
        '[mobile:android:usb]   ANDROID_HOME=<path-to-Android-Sdk>',
        '[mobile:android:usb]   ANDROID_SDK_ROOT=<path-to-Android-Sdk>',
        '[mobile:android:usb] Expected a folder like C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk with at least `platform-tools` and `platforms`.',
      ].join('\n')
    );
  }

  const adbPath = resolveAdbPath();
  const platformToolsDir = path.join(sdkPath, 'platform-tools');
  const pathSeparator = isWindows ? ';' : ':';
  const mergedPath = [platformToolsDir, path.dirname(adbPath), process.env.PATH]
    .filter(Boolean)
    .join(pathSeparator);

  const env = {
    ...process.env,
    ANDROID_HOME: sdkPath,
    ANDROID_SDK_ROOT: sdkPath,
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PATH: mergedPath,
  };

  console.log(`[mobile:android:usb] Using Android SDK: ${sdkPath}`);
  console.log(`[mobile:android:usb] Using adb: ${adbPath}`);
  if (enableDevClient) {
    console.log(
      '[mobile:android:usb] Dev client mode enabled. The native Android app will include expo-dev-client.'
    );
  }

  writeAndroidLocalProperties(sdkPath);
  clearAndroidAutolinkingCache();
  if (enableDevClient) {
    clearNativeAndroidBuildCaches();
  }

  const usbSetup = runPnpm(['android:usb'], {
    cwd: projectRoot,
    env,
  });

  if ((usbSetup.status ?? 1) !== 0) {
    process.exit(usbSetup.status ?? 1);
  }

  if (enableDevClient) {
    uninstallAndroidAppIfPresent(adbPath, env);
  }

  const metroAlreadyRunning = await isMetroAlreadyRunning();
  const shouldReuseBundler = enableDevClient || metroAlreadyRunning;
  const androidArgs = shouldReuseBundler
    ? ['--filter', 'field-service-mobile', 'exec', 'expo', 'run:android', '--no-bundler']
    : ['--filter', 'field-service-mobile', 'android'];

  if (shouldReuseBundler) {
    console.log(
      enableDevClient
        ? '[mobile:android:usb] Reusing the existing Metro/dev-client server and running Android build with --no-bundler.'
        : '[mobile:android:usb] Port 8081 is already in use. Reusing the existing Metro server and running Android build with --no-bundler.'
    );
  }

  const androidRun = runPnpm(androidArgs, {
    cwd: projectRoot,
    env,
  });

  process.exit(androidRun.status ?? 0);
}
main().catch((error) => {
  fail(`[mobile:android:usb] ${error.message}`);
});
