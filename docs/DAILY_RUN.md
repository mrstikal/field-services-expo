# Daily Run (Web + Mobile USB)

Quick daily startup flow for Windows, Linux, and macOS with an Android phone connected over USB.

Use one of these mobile modes:

- `Expo Go`: acceptable for non-push development only.
- `Dev Client`: required for Android remote push notifications and other native-only checks.

For stable Android mobile E2E on an emulator, prefer `pnpm run test:e2e:mobile:emulator` from the repo root. That workflow boots or reuses an emulator, ensures the app is installed, and then runs Maestro against the emulator explicitly.

## 1) Prerequisites

- Android `USB debugging` is enabled.
- `adb devices` shows the device as `device`.
- `apps/mobile/.env.local` contains `EXPO_PUBLIC_API_URL=http://localhost:3000`.

### Windows

- Install Android Studio with Android SDK.
- Run `pnpm android:sdk:windows` once after the SDK is installed.
- For Expo Go, install Expo Go on the phone.
- For native testing, the dev client app will be installed by `pnpm mobile:dev-client:android:usb`.

### Linux / macOS

- Install Android Studio with Android SDK.
- Export `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and add `$ANDROID_HOME/platform-tools` to `PATH`.
- For Expo Go, install Expo Go on the phone.
- For native testing, the dev client app will be installed by `pnpm mobile:dev-client:android:usb`.

## 2) Web (terminal 1)

### Quick combined start from repo root

```powershell
Set-Location "F:\expo\field-service"
pnpm dev:all
```

- Starts both:
  - web (`apps/web`) on `http://localhost:3000`
  - mobile Metro on `http://127.0.0.1:8081`
- If a stale `field-service-web` dev server from a previous run is still holding `3000`, `pnpm dev:all` releases it before starting a fresh one.
- If port `3000` is occupied by some other process, `pnpm dev:all` stops immediately and prints the owning PID/command instead of silently switching the web app to another port.
- On Windows, it also attempts to:
  - detect `adb`
  - run `adb reverse` for ports `8081` and `3000`
  - open Expo Go with `exp://127.0.0.1:8081`
- If no Android device is connected, Metro and web still start normally.
- After `Ctrl+C`, a new `pnpm dev:all` run should come back on the same ports without any manual cleanup.

### Quick combined dev client start

#### Windows

```powershell
Set-Location "F:\expo\field-service"
pnpm android:sdk:windows
pnpm dev:all:dev-client:windows
```

- Starts web on `3000`.
- Starts Metro in `--dev-client` mode on `8081`.
- Builds and installs the Android dev client over USB.
- Keeps web + Metro running after the native build finishes.

#### Linux / macOS

```bash
cd /path/to/field-service
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
pnpm dev:all:dev-client:posix
```

- Same flow as Windows, but expects Android SDK and `adb` to already be configured in the shell.

### Windows (PowerShell)

```powershell
Set-Location "F:\expo\field-service\apps\web"
pnpm dev
```

### Linux / macOS (bash/zsh)

```bash
cd /path/to/field-service/apps/web
pnpm dev
```

- Web runs on `http://localhost:3000` when the port is free.

## 3) Mobile Metro (terminal 2)

### Expo Go: Windows / Linux / macOS

```bash
cd /path/to/field-service
pnpm mobile:metro:usb
```

- The script always starts Metro on `8081` and, if needed, stops the process currently using that port first.
- The script starts Expo with `CI=1`, so it fails fast instead of hanging on prompts such as `Fix dependencies?`.

### Dev Client: Windows / Linux / macOS

```bash
cd /path/to/field-service
pnpm mobile:metro:dev-client:usb
```

- This uses `expo start --dev-client --localhost --port 8081 --clear`.
- Use this mode when testing Android remote push notifications.

## 4) USB bridge + open app (terminal 3)

### Expo Go

> This step is still useful as a manual fallback. When `pnpm dev:all` succeeds on Windows with a connected device, you usually do not need to run it separately.

### Windows (PowerShell)

```powershell
$adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools_*\platform-tools\adb.exe").FullName
& $adb devices
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:3000 tcp:3000
& $adb reverse --list
& $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

### Linux / macOS (bash/zsh)

```bash
adb devices
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
adb reverse --list
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

### Dev Client

#### Windows (PowerShell)

```powershell
Set-Location "F:\expo\field-service"
pnpm mobile:dev-client:android:usb
```

#### Linux / macOS (bash/zsh)

```bash
cd /path/to/field-service
pnpm mobile:dev-client:android:usb
```

- The script validates Android SDK availability, runs `adb reverse`, and calls `expo run:android`.
- The script also clears stale Android autolinking cache before build, so package/namespace changes are picked up immediately.
- If the dev client is already installed and you only need to reopen it, use:

```bash
adb shell monkey -p cz.fieldservice.app -c android.intent.category.LAUNCHER 1
```

## 5) Quick validation

- Expo Go mode: mobile app opens in Expo Go without errors.
- Dev client mode: the native `cz.fieldservice.app` app opens and connects to Metro.
- Web is available at `http://localhost:3000`.
- Login flow does not show bundler/runtime errors.
- If the web/API server is unavailable, the mobile app shows a warning banner with the current server status and hints about `pnpm --filter field-service-web dev` and `adb reverse tcp:3000 tcp:3000`.

## 6) Common issues

### `device offline`

```powershell
$adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools_*\platform-tools\adb.exe").FullName
& $adb kill-server
& $adb start-server
& $adb devices
```

- Unlock phone and confirm `Allow USB debugging` again.
- Switch USB mode to `File Transfer (MTP)`.

### `No apps connected`

```powershell
& $adb reverse tcp:8081 tcp:8081
& $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

### `Failed to resolve the Android SDK path`

#### Windows

```powershell
Set-Location "F:\expo\field-service"
pnpm android:sdk:windows
```

- Restart PowerShell after the script updates the user `PATH`.
- Retry `pnpm mobile:dev-client:android:usb`.

#### Linux / macOS

- Verify `ANDROID_HOME` and `ANDROID_SDK_ROOT`.
- Confirm the SDK contains `platform-tools` and `platforms`.

### Expo prompt `Log in / Proceed anonymously`

- If terminal 2 shows:
  - `It is recommended to log in with your Expo account before proceeding`
  - `Log in` / `Proceed anonymously`
- this project uses `EXPO_OFFLINE=1` in:
  - `scripts/start-mobile-metro-usb.mjs`
    so the prompt should not appear.
- `EXPO_OFFLINE=1` is an environment variable, not the `--offline` CLI flag. Keep `--localhost` for USB + `adb reverse`.
- Until this prompt is resolved, Metro is not fully started and Expo Go can stay on loader and end with `Something went wrong`.

### Expo prompt `Fix dependencies?`

- `pnpm mobile:metro:usb` now runs Expo with `CI=1`.
- If dependency compatibility is broken, the command exits instead of waiting forever on `Fix dependencies?`.
- Recover with:

```powershell
Set-Location "F:\expo\field-service\apps\mobile"
pnpm install
```

- Then start Metro again from the repo root:

```powershell
Set-Location "F:\expo\field-service"
pnpm mobile:metro:usb
```

For dev client mode, rerun:

```powershell
Set-Location "F:\expo\field-service"
pnpm mobile:metro:dev-client:usb
```

### Port 3000 is already in use

```powershell
Set-Location "F:\expo\field-service"
pnpm dev:all
```

- If the process on `3000` is a stale `field-service-web` dev server from this repo, `dev:all` stops it automatically.
- If `3000` is held by a different application, `dev:all` exits and prints the PID/command line so you can stop that process and rerun.

### Android push notifications still fail

- Expo Go on Android cannot test remote push notifications with Expo SDK 53+.
- Use the dev client workflow instead:
  - terminal 1: `pnpm mobile:metro:dev-client:usb`
  - terminal 2: `pnpm mobile:dev-client:android:usb`
