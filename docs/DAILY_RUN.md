# Daily Run (Web + Mobile USB)

Quick daily startup flow for Windows (PowerShell) with an Android phone connected over USB.

## 1) Prerequisites

- Expo Go installed on the phone is compatible with the project's Expo SDK.
- Android `USB debugging` is enabled.
- `adb devices` shows the device as `device`.
- `apps/mobile/.env.local` contains `EXPO_PUBLIC_API_URL=http://localhost:3000`.

## 2) Web (terminal 1)

```powershell
Set-Location "F:\expo\field-service\apps\web"
pnpm dev
```

- Web runs on `http://localhost:3000` when the port is free.

## 3) Mobile Metro (terminal 2)

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Set-Location "F:\expo\field-service\apps\mobile"
Remove-Item ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
pnpm exec expo start --localhost --port 8081 --clear
```

## 4) USB bridge + open app (terminal 3)

```powershell
$adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools_*\platform-tools\adb.exe").FullName
& $adb devices
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:3000 tcp:3000
& $adb reverse --list
& $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

## 5) Quick validation

- Mobile app opens in Expo Go without errors.
- Web is available at `http://localhost:3000`.
- Login flow does not show bundler/runtime errors.

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

### Port 3000 is already in use

```powershell
Set-Location "F:\expo\field-service\apps\web"
pnpm dev -- -p 3001
```

- If web runs on 3001, also update `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to `http://localhost:3001` and restart Metro.

