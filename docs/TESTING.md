$env:EXPO_NATIVE_TESTS="1"; pnpm --filter field-service-mobile vitest run lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
EXPO_NATIVE_TESTS=1 pnpm --filter field-service-mobile vitest run lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
# Testing Guide

This project uses Vitest for unit/integration tests and Playwright + Maestro for E2E.

## Root test commands

```bash
pnpm run test:shared
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run test:e2e:web
pnpm run test:e2e:web:reset
pnpm run test:e2e:mobile
pnpm run test:e2e:mobile:emulator
pnpm run test:e2e:full
pnpm run test:all
```

## What each command does

- `test:shared`: shared package tests (`packages/shared-types`, `packages/db`)
- `test:unit`: shared + mobile unit + web unit
- `test:integration`: mobile integration + web integration
- `test:e2e`: default portable E2E entry point; runs web E2E only
- `test:e2e:web`: Playwright web E2E
- `test:e2e:web:reset`: destructive demo reset + Playwright web E2E
- `test:e2e:mobile`: Maestro mobile E2E; requires device/emulator + Maestro CLI
- `test:e2e:mobile:emulator`: boot/find Android emulator, ensure app install, then run Maestro mobile E2E
- `test:e2e:full`: mobile E2E + web E2E
- `test:all`: unit + integration + default E2E (`test:e2e`)

## Mobile native-only suites

- `apps/mobile/lib/db/__tests__/conversation-repository.test.ts`
Some mobile suites require Expo native runtime and are excluded from default jsdom runs:
- `apps/mobile/lib/db/__tests__/message-repository.test.ts`

- `apps/mobile/__tests__/integration/sync-flow.test.ts`
- `apps/mobile/__tests__/integration/sync-resilience.test.ts`

Run them only when native runtime prerequisites are available:

EXPO_NATIVE_TESTS=1 pnpm --filter field-service-mobile vitest run lib/db/__tests__/conversation-repository.test.ts lib/db/__tests__/message-repository.test.ts lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
EXPO_NATIVE_TESTS=1 pnpm --filter field-service-mobile vitest run lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
```

PowerShell variant:

$env:EXPO_NATIVE_TESTS="1"; pnpm --filter field-service-mobile vitest run lib/db/__tests__/conversation-repository.test.ts lib/db/__tests__/message-repository.test.ts lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
$env:EXPO_NATIVE_TESTS="1"; pnpm --filter field-service-mobile vitest run lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
```

## E2E prerequisites

- `test:e2e` is intentionally OS-portable and runs only the web Playwright suite.
- `test:e2e:web` and `test:e2e` require browser tooling (Playwright) and web app availability.
- Mobile E2E requires connected/available device/emulator for Maestro flows.
- `test:e2e:mobile` and `test:e2e:full` additionally require Maestro mobile tooling.
- `test:e2e:mobile:emulator` is the recommended stable workflow for Android mobile E2E.
- Maestro CLI is resolved from `PATH`, `MAESTRO_BIN`, or common OS-specific install locations.
- On Android, the device/emulator must allow adb-driven APK installs for Maestro helper apps.
- Web Playwright setup does not reset Supabase automatically. This is intentional because reset is destructive.

### Recommended Android emulator workflow

Use an emulator instead of a random physical phone:

```bash
pnpm run test:e2e:mobile:emulator
```

What the script does:

- resolves `adb` and `emulator` from Android SDK or `PATH`
- uses a running emulator if one already exists
- otherwise starts an AVD
- waits for Android boot completion
- installs `com.fieldservice.app` if needed
- binds Maestro to that emulator device explicitly

Optional environment variables:

- `ANDROID_AVD_NAME`: choose a specific emulator when multiple AVDs exist
- `ANDROID_EMULATOR_ARGS`: extra args passed to `emulator`, for example `-no-snapshot -no-boot-anim`
- `E2E_ANDROID_INSTALL_APP=1`: force reinstall of the mobile app before the Maestro run
- `MAESTRO_REINSTALL_DRIVER=1`: force reinstall of Maestro helper apps when troubleshooting device state

If multiple AVDs are installed and `ANDROID_AVD_NAME` is not set, the script fails intentionally instead of guessing.

### Notes for physical Android devices

- The current Android debug app id used by mobile E2E is `com.fieldservicemonorepo`.
- Mobile E2E now uses `--no-reinstall-driver` by default, so Maestro should stop asking for the same helper APK installs on every run.
- If the helper apps need to be repaired or reinstalled, run once with `MAESTRO_REINSTALL_DRIVER=1`.

If you need a clean demo baseline for an isolated test environment, run the reset explicitly:

```bash
pnpm run test:e2e:web:reset
```

PowerShell variant:

```powershell
pnpm run test:e2e:web:reset
```

If you want to run the two steps separately, `pnpm run demo:reset` prepares the baseline and `pnpm exec playwright test` runs Playwright without another implicit reset.

If `demo:reset` reports missing columns, apply the SQL it prints in Supabase first. The script now aborts before deleting data when schema validation fails.

If mobile device is unavailable, use `test:e2e` or `test:e2e:web` and skip `test:e2e:mobile`.
