# Daily Run (Web + Mobile: Wi-Fi or USB)

Quick daily startup flow for Windows, Linux, and macOS.

## 0) Scenario -> Command

| Scenario | Command (repo root) | Notes |
| --- | --- | --- |
| Same network (fastest setup) | `pnpm dev:all:wifi` | Recommended. Opens via Expo Go over LAN. |
| No shared Wi-Fi / no Wi-Fi on computer | `pnpm dev:all` | USB fallback with `adb reverse`. |
| Native-only checks (push notifications, dev client) | `pnpm dev:all:dev-client:windows` (Windows) / `pnpm dev:all:dev-client:posix` (Linux/macOS) | Uses Android dev client instead of Expo Go. |

Choose one connection mode first:

- `Wi-Fi (recommended for demos)`: phone and computer are on the same Wi-Fi.
- `USB (fallback)`: use when the computer has no Wi-Fi, or phone/computer cannot be put on the same Wi-Fi.

Then choose one mobile runtime mode:

- `Expo Go`: acceptable for non-push development only.
- `Dev Client`: required for Android remote push notifications and other native-only checks.

For stable Android mobile E2E on an emulator, prefer `pnpm run test:e2e:mobile:emulator` from the repo root. That workflow boots or reuses an emulator, ensures the app is installed, and then runs Maestro against the emulator explicitly.

## 1) Prerequisites

- `apps/mobile/.env.local` exists.
- For Wi-Fi mode:
  - phone and computer are on the same local network.
  - avoid guest Wi-Fi / AP isolation.
- For USB mode:
  - Android `USB debugging` is enabled.
  - `adb devices` shows the device as `device`.

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

## 2) Quick Start (choose one)

### A) Wi-Fi + Expo Go (recommended for recruiter demos)

From repo root:

```powershell
Set-Location "F:\expo\field-service"
pnpm dev:all:wifi
```

What this does:

- stops stale listeners on ports `8080` and `8081`.
- starts web (`apps/web`) on port `3000`.
- starts mobile Metro in Expo Go LAN mode on `8081`.
- auto-detects LAN IP and sets mobile API URL to `http://<LAN_IP>:3000`.
- prints a direct `exp://...` QR in terminal.

Important:

- In Expo Go, scan the QR printed by `dev:all:wifi` (`Direct Expo Go URL`).
- Do not scan with system camera/Chrome.
- Scan code after *Scan ONLY this QR in Expo Go. Ignore Expo CLI QR output.* in CLI only. 

### B) USB (fallback when Wi-Fi is not possible)

From repo root:

```powershell
Set-Location "F:\expo\field-service"
pnpm dev:all
```

This keeps web on `3000`, Metro on `8081`, and configures `adb reverse` for `3000/8081`.

## 3) Manual start (if quick start fails)

### Wi-Fi mode (Expo Go)

Terminal 1 (web):

```powershell
Set-Location "F:\expo\field-service\apps\web"
pnpm exec next dev --hostname 0.0.0.0 --port 3000
```

Terminal 2 (mobile Metro):

```powershell
Set-Location "F:\expo\field-service\apps\mobile"
$env:REACT_NATIVE_PACKAGER_HOSTNAME="<LAN_IP>"
$env:EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"
$env:EXPO_PUBLIC_API_URL="http://<LAN_IP>:3000"
pnpm exec expo start --go --host lan --port 8081 --clear
```

### USB mode (Expo Go)

Terminal 1:

```powershell
Set-Location "F:\expo\field-service"
pnpm dev:all
```

### USB mode (Dev Client)

#### Windows

```powershell
Set-Location "F:\expo\field-service"
pnpm android:sdk:windows
pnpm dev:all:dev-client:windows
```

#### Linux / macOS

```bash
cd /path/to/field-service
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
pnpm dev:all:dev-client:posix
```

## 4) USB bridge + open app (manual fallback)

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
- Web is available at `http://localhost:3000` on the computer.
- Login flow does not show bundler/runtime errors.
- In Wi-Fi mode, mobile app reaches API via `http://<LAN_IP>:3000`.
- In USB mode, mobile app reaches API via `http://localhost:3000` through `adb reverse`.

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

### `Web is not running or is unreachable from the mobile app`

- In Wi-Fi mode:
  - verify web is running on `3000`.
  - verify phone and computer are on the same subnet.
  - rerun `pnpm dev:all:wifi` so mobile API URL is re-injected as `http://<LAN_IP>:3000`.
- In USB mode:
  - rerun `adb reverse tcp:3000 tcp:3000`.

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
