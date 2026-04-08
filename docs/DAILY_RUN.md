# Daily Run (Web + Mobile USB)

Quick daily startup flow for Windows, Linux, and macOS with an Android phone connected over USB.

For stable Android mobile E2E on an emulator, prefer `pnpm run test:e2e:mobile:emulator` from the repo root. That workflow boots or reuses an emulator, ensures the app is installed, and then runs Maestro against the emulator explicitly.

## 1) Prerequisites

- Expo Go installed on the phone is compatible with the project's Expo SDK.
- Android `USB debugging` is enabled.
- `adb devices` shows the device as `device`.
- `apps/mobile/.env.local` contains `EXPO_PUBLIC_API_URL=http://localhost:3000`.

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

### Windows / Linux / macOS

```bash
cd /path/to/field-service
pnpm mobile:metro:usb
```

- The script always starts Metro on `8081` and, if needed, stops the process currently using that port first.
- The script starts Expo with `CI=1`, so it fails fast instead of hanging on prompts such as `Fix dependencies?`.

## 4) USB bridge + open app (terminal 3)

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

## 5) Quick validation

- Mobile app opens in Expo Go without errors.
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

### Port 3000 is already in use

```powershell
Set-Location "F:\expo\field-service"
pnpm dev:all
```

- If the process on `3000` is a stale `field-service-web` dev server from this repo, `dev:all` stops it automatically.
- If `3000` is held by a different application, `dev:all` exits and prints the PID/command line so you can stop that process and rerun.
