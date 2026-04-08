# Testing Guide

This project uses Vitest for unit/integration tests and Playwright + Maestro for E2E.

## Root test commands

```bash
pnpm run test:shared
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run test:all
```

## What each command does

- `test:shared`: shared package tests (`packages/shared-types`, `packages/db`)
- `test:unit`: shared + mobile unit + web unit
- `test:integration`: mobile integration + web integration
- `test:e2e`: mobile E2E (Maestro) + web E2E (Playwright)
- `test:all`: unit + integration + e2e

## Mobile native-only suites

Some mobile suites require Expo native runtime and are excluded from default jsdom runs:

- `apps/mobile/lib/db/__tests__/db-integration.test.ts`
- `apps/mobile/__tests__/integration/sync-flow.test.ts`
- `apps/mobile/__tests__/integration/sync-resilience.test.ts`

Run them only when native runtime prerequisites are available:

```bash
EXPO_NATIVE_TESTS=1 pnpm --filter field-service-mobile vitest run lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
```

PowerShell variant:

```powershell
$env:EXPO_NATIVE_TESTS="1"; pnpm --filter field-service-mobile vitest run lib/db/__tests__/db-integration.test.ts __tests__/integration/sync-flow.test.ts __tests__/integration/sync-resilience.test.ts
```

## E2E prerequisites

- `test:e2e` requires running app services and test tooling.
- Mobile E2E requires connected/available device/emulator for Maestro flows.
- Web E2E requires browser tooling (Playwright) and web app availability.

If mobile device is unavailable, skip `test:e2e` and run `test:unit` + `test:integration`.
