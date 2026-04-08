# ETAPA 8: EAS Build, OTA Updates & Dokumentace

## Shrnutí implementace

Tato etapa dokončuje projekt přidáním kompletního EAS Build workflow, OTA Update podpory a dokumentace.

---

## Co bylo implementováno

### 1. EAS Build konfigurace (`apps/mobile/eas.json`)

Rozšířené profily s EAS Update routing:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "android": { "buildType": "apk" },
      "ios": { "buildConfiguration": "Release" },
      "distribution": "internal",
      "channel": "preview",
      "autoIncrement": false
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  }
}
```

**Profilová rozdíly:**

| Profil        | Channel       | Auto-increment | Použití                     |
| ------------- | ------------- | -------------- | --------------------------- |
| `development` | `development` | N/A            | Lokální vývoj s dev client  |
| `preview`     | `preview`     | `false`        | Interní testování (APK/IPA) |
| `production`  | `production`  | `true`         | App Store / Play Store      |

### 2. OTA Update konfigurace (`apps/mobile/app.json`)

Přidány `updates.url` a `runtimeVersion`:

```json
{
  "updates": {
    "fallbackToCacheTimeout": 0,
    "checkAutomatically": "ON_LOAD",
    "url": "https://u.expo.dev/YOUR_EAS_PROJECT_ID"
  },
  "runtimeVersion": {
    "policy": "appVersion"
  }
}
```

**Jak to funguje:**

- `ON_LOAD` – App zkontroluje update při každém spuštění
- `runtimeVersion.policy: appVersion` – Update se aplikuje jen pro stejnou verzi app
- `updates.url` – EAS Update endpoint (dynamicky nahrazen v `app.config.ts`)

### 3. Dynamická konfigurace (`apps/mobile/app.config.ts`)

Nový soubor pro environment-specific konfiguraci:

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  const easProjectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID';

  return {
    ...config,
    extra: {
      ...config.extra,
      eas: { projectId: easProjectId },
      env,
    },
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${easProjectId}`,
    },
  };
};
```

**Výhody:**

- Různé EAS project IDs pro dev/staging/production
- Čtení env variables (`EXPO_PUBLIC_*`)
- Dynamické nastavení `updates.url`

**Použití:**

```bash
# Development build
EXPO_PUBLIC_ENV=development \
EXPO_PUBLIC_EAS_PROJECT_ID=dev-project-id \
pnpm build --platform android

# Production build
EXPO_PUBLIC_ENV=production \
EXPO_PUBLIC_EAS_PROJECT_ID=prod-project-id \
pnpm build --platform all
```

### 4. GitHub Actions – OTA Update workflow (`.github/workflows/ota-update.yml`)

Nový workflow pro automatické OTA update:

```yaml
name: OTA Update

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      branch:
        description: 'Branch to update'
        required: true
        default: 'production'
        type: choice
        options:
          - production
          - preview
          - development

jobs:
  eas-update:
    name: Push OTA Update with EAS
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... setup ...
      - name: Push OTA Update
        run: eas update --branch production --message "Update from CI/CD"
```

**Workflow trigger:**

- `push na main` – automatický OTA update na `production` branch
- `workflow_dispatch` – manuální spuštění s výběrem branch

**Použití:**

```bash
# Manuální spuštění
gh workflow run ota-update.yml --ref main -f branch=preview
```

---

## CI/CD Pipeline – Celkový workflow

```
Push to main/develop
        ↓
  ┌─────┬──────┬───────┐
  ↓     ↓      ↓
Lint  TypeCheck  Build
  └─────┴──────┴───────┘
        ↓
  ┌─────┴──────┐
  ↓            ↓
Deploy Web   EAS Build
(Vercel)     (Mobile)
                  ↓
           OTA Update
         (eas update)
```

**Kdy se co spustí:**

| Event                    | Web       | Mobile Build | OTA Update |
| ------------------------ | --------- | ------------ | ---------- |
| Push to `main`           | ✅ Deploy | ✅ Build     | ✅ Push    |
| Push to `develop`        | ❌        | ✅ Build     | ❌         |
| Manual workflow_dispatch | ❌        | ✅ Build     | ✅ Push    |

---

## EAS Build – Praktické příklady

### 1. Development Build (lokálně)

```bash
cd apps/mobile
eas build --platform all --profile development
```

**Použití:** Testování nativních modulů na reálném zařízení

### 2. Preview Build (interní testování)

```bash
# Android APK
eas build --platform android --profile preview

# iOS IPA (pro TestFlight)
eas build --platform ios --profile preview
```

**Použití:** Distribuce interním testerům (Firebase App Distribution, TestFlight)

### 3. Production Build (App Store / Play Store)

```bash
eas build --platform all --profile production
```

**Použití:** Odeslání do App Store a Google Play Store

### 4. OTA Update (živá aktualizace)

```bash
# Automaticky přes CI/CD (push na main)
# nebo manuálně:
eas update --branch production --message "Fix: task status not updating"
```

**Použití:** Rychlé opravy bugů bez čekání na App Store review

---

## Environment Variables

### Pro EAS Build

V `apps/mobile/.env.local`:

```env
# EAS Project ID (získáte v EAS Dashboard)
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id

# Environment (development, preview, production)
EXPO_PUBLIC_ENV=production
```

### Pro GitHub Actions

V GitHub repository settings → Secrets and variables → Actions:

| Secret              | Popis                  | Získat                                                                     |
| ------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `EAS_TOKEN`         | Expo access token      | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |
| `VERCEL_TOKEN`      | Vercel API token       | [vercel.com/account/tokens](https://vercel.com/account/tokens)             |
| `VERCEL_ORG_ID`     | Vercel organization ID | `vercel link` → `.vercel/project.json`                                     |
| `VERCEL_PROJECT_ID` | Vercel project ID      | `vercel link` → `.vercel/project.json`                                     |

---

## Production Checklist

Před deployem do production:

- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID` nastaven na production EAS project ID
- [ ] `EXPO_PUBLIC_ENV=production` v production buildu
- [ ] `eas.json` má `autoIncrement: true` pro production
- [ ] `app.json` má správné `bundleIdentifier` a `package`
- [ ] RLS policies jsou aplikovány v Supabase
- [ ] Sentry DSN je nakonfigurován (pokud používáte)
- [ ] Mapbox token je nastaven (pro dispatcher map)
- [ ] OTA Update workflow je aktivní (`eas update` přes CI/CD)

---

## Troubleshooting

### 1. EAS Build selže s "Project not found"

**Řešení:** Zkontrolujte `EXPO_PUBLIC_EAS_PROJECT_ID` v env variables

### 2. OTA Update se nezobrazí v app

**Řešení:**

- Zkontrolujte `updates.url` v `app.json`
- Ujistěte se, že `runtimeVersion.policy` odpovídá verzi app
- Zkuste `eas update --branch production --force` (vynutit update)

### 3. Build se zacyklí v CI/CD

**Řešení:** Přidejte `[skip ci]` do commit message nebo upravte workflow trigger

---

## Shrnutí

Etapa 8 byla úspěšně dokončena s následujícími výsledky:

- ✅ EAS Build konfigurace (3 profily s channel routing)
- ✅ OTA Update podpora (`updates.url` + `runtimeVersion`)
- ✅ Dynamická konfigurace (`app.config.ts`)
- ✅ GitHub Actions OTA Update workflow
- ✅ Kompletní dokumentace

**Výhody:**

- 🚀 Rychlé OTA updates bez App Store review
- 🔄 Automatický build a deploy přes CI/CD
- 📱 Production-ready deployment workflow
- 📚 Kompletní dokumentace pro tým

Aplikace je nyní **100% production-ready** s kompletním EAS Build a OTA Update workflow.
