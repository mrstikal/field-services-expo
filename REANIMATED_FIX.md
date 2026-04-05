# Oprava chyby Reanimated v Expo Mobile App

## ❌ Původní Problém
Při spouštění Metro bundleru přes USB se zobrazovaly chyby:
```
ERROR  [TypeError: Cannot read property 'S' of undefined]
ERROR  [TypeError: Cannot read property 'default' of undefined]
```

## 🔍 Root Cause Analýza
1. **Chybějící Babel plugin**: `react-native-reanimated` se používá v `task-detail-transition.tsx`, ale `babel.config.js` **neměl plugin** pro transformaci Reanimated kódu
2. **Monorepo struktura**: `react-native-reanimated` je v `F:\expo\field-service\node_modules`, nikoliv v `apps/mobile/node_modules`
3. **Stará Metro cache**: Bundler používal cached bundly bez správné transformace

## ✅ Aplikovaná Řešení

### 1. Babel Config (apps/mobile/babel.config.js)
**ZMĚNA:** Přidán `react-native-reanimated/plugin`

```javascript
/* eslint-disable no-undef */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      ['react-native-reanimated/plugin', {
        relativeSourceLocation: true,  // Důležité pro monorepo!
      }],
    ],
  };
};
```

### 2. Start Metro Script (apps/mobile/start-metro.ps1)
**ZMĚNA:** Aktualizován na `pnpm exec` (Windows kompatibilita)

```powershell
pnpm exec expo start --localhost --port 8081 --clear
```

### 3. Metro Config (apps/mobile/metro.config.js)
**JIŽ KONFIGUROVÁN:** Správně zpracovává monorepo strukturu s `watchFolders` a `nodeModulesPaths`

### 4. Package.json (apps/mobile/package.json)
**AKTUALIZOVÁNY VERZE:**
- `expo`: `^54.0.0`
- `react-native-reanimated`: `^3.16.0` ← Klíčové pro `@gorhom/bottom-sheet`
- `expo-router`: `^3.5.0`

## 🚀 Jak Spustit (OPRAVENO)

### Terminal 1 - Web Server
```powershell
cd F:\expo\field-service\apps\web
pnpm dev
```
✓ Web běží na `http://localhost:3000`

### Terminal 2 - Metro Bundler (JE OPRAVENO!)
```powershell
cd F:\expo\field-service\apps\mobile
pnpm install  # Pokud nebyl spuštěn
pnpm dev      # NEBO: .\start-metro.ps1
```

**Očekávaný výstup (BEZ chyb):**
```
Logs for your project will appear below. Press Ctrl+C to exit.
...
Android Bundled XXXms ...
Connected to Expo
```

### Terminal 3 - USB Bridge (SPUSŤTE AŽ PO METRO)
Jakmile Metro běží (až uvidíte "Connected to Expo"), spusťte:

```powershell
$adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools_*\platform-tools\adb.exe").FullName
& $adb devices
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:3000 tcp:3000
& $adb reverse --list
& $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

## ✨ Co Se Opravilo
- ✅ **Babel** nyní správně transformuje `react-native-reanimated` kód
- ✅ **Metro** nebude vyvolávat "Cannot read property 'S'" chyby
- ✅ **Komponenta** `TaskDetailTransition` s animacemi bude fungovat
- ✅ **Monorepo** struktura je správně nakonfigurována

## 🔧 Troubleshooting

### Chyby se stále objevují?
1. **Vyčistit cache:**
   ```powershell
   cd F:\expo\field-service\apps\mobile
   Remove-Item -Path ".\.expo", ".\dist", ".\.turbo" -Recurse -Force
   ```

2. **Restartovat Metro s `--clear`:**
   ```powershell
   pnpm dev -- --clear
   ```

3. **Ověřit babel.config.js:**
   ```
   Měl by obsahovat: plugins: [['react-native-reanimated/plugin', ...]]
   ```

### Port 8081 je obsazen?
```powershell
netstat -ano | findstr "8081"
# Pak: taskkill /F /PID <PID>
```

---
**Datum opravy:** 2026-04-05
**Komponenty dotčené opravou:** `TaskDetailTransition`, všechny Reanimated animace

