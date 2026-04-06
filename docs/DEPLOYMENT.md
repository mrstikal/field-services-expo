# Field Service App – Deployment Guide

Complete guide for deploying the Field Service application to production.

## 📋 Overview

| Component | Platform | Method |
|-----------|----------|--------|
| Web Dashboard | Vercel | GitHub Actions / CLI |
| Mobile App | EAS Build | GitHub Actions / CLI |
| Database | Supabase | Managed cloud |
| OTA Updates | EAS Update | CLI |

---

## 🌐 Web Deployment (Vercel)

### Prerequisites
- Vercel account at [vercel.com](https://vercel.com)
- Vercel CLI installed: `npm install -g vercel`
- Environment variables configured (see [ENVIRONMENT.md](./ENVIRONMENT.md))

### Manual Deployment

```bash
# Link project to Vercel (first time only)
cd apps/web
vercel link

# Deploy to production
vercel deploy --prod
```

### Automatic Deployment via GitHub Actions

The CI/CD pipeline in `.github/workflows/ci.yml` automatically deploys the web app on every push to `main`.

**Required GitHub Secrets:**
```
VERCEL_TOKEN        – Vercel API token
VERCEL_ORG_ID       – Vercel organization ID
VERCEL_PROJECT_ID   – Vercel project ID
```

To get these values:
1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens) → create token
2. Run `vercel link` locally → check `.vercel/project.json` for org/project IDs

### Environment Variables on Vercel

Set these in the Vercel dashboard under **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
```

---

## 📱 Mobile Deployment (EAS Build)

### Prerequisites
- Expo account at [expo.dev](https://expo.dev)
- EAS CLI installed: `npm install -g eas-cli`
- Logged in: `eas login`

### Build Profiles

The `apps/mobile/eas.json` defines three profiles:

| Profile | Purpose | Distribution |
|---------|---------|--------------|
| `development` | Local development with dev client | Internal |
| `preview` | Internal testing (APK/TestFlight) | Internal |
| `production` | App Store / Play Store release | Store |

### Building

```bash
cd apps/mobile

# Development build (for testing native modules locally)
eas build --platform all --profile development

# Preview build (APK for Android, IPA for iOS internal testing)
eas build --platform all --profile preview

# Production build
eas build --platform all --profile production

# Build for a single platform
eas build --platform android --profile production
eas build --platform ios --profile production
```

### Submitting to Stores

```bash
# Submit to Google Play Store
eas submit --platform android --profile production

# Submit to Apple App Store
eas submit --platform ios --profile production
```

### Automatic EAS Build via GitHub Actions

The workflow in `.github/workflows/dev-build.yml` triggers EAS builds automatically.

**Required GitHub Secret:**
```
EAS_TOKEN   – Expo access token (from expo.dev/accounts/[user]/settings/access-tokens)
```

---

## 🔄 OTA Updates (EAS Update)

Over-the-Air updates allow pushing JavaScript/asset changes without going through the App Store review process.

### How It Works

1. Make changes to JavaScript/TypeScript code
2. Run `eas update` to publish the update
3. App downloads the update on next launch (or on error recovery)
4. No App Store review required for JS-only changes

> **Note:** Native code changes (new native modules, permissions, etc.) still require a full EAS Build.

### Publishing an Update

```bash
cd apps/mobile

# Publish to production branch
eas update --branch production --message "Fix: task status not updating"

# Publish to preview branch (for testing)
eas update --branch preview --message "Feature: new filter options"
```

### Update Policy

Configured in `apps/mobile/app.json`:
- `ON_LAUNCH` – Check for updates every time the app launches
- `ON_ERROR_RECOVERY` – Only update when the app encounters a fatal error

---

## 🗄️ Database (Supabase)

The database is managed by Supabase and does not require manual deployment. However, schema changes and RLS policies must be applied manually.

### Applying Schema Changes

```bash
# Push schema changes to Supabase
cd packages/db
pnpm drizzle-kit push
```

### Applying RLS Policies

1. Open Supabase Dashboard → SQL Editor
2. Paste contents of `packages/db/rls-policies.sql`
3. Click **Run**

Or via CLI:
```bash
psql -U postgres -d postgres -h db.your-project.supabase.co -p 5432 -f packages/db/rls-policies.sql
```

### Seeding Demo Data

```bash
# Seed the database with demo data
pnpm db:seed

# Or reset to clean demo state
pnpm demo:reset
```

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for full details.

---

## ⚙️ CI/CD Pipeline

### Workflow: `ci.yml` (Main Pipeline)

Triggered on push to `main` and `develop` branches.

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
```

**Steps:**
1. `pnpm lint` – ESLint check
2. `pnpm typecheck` – TypeScript type check
3. `pnpm build` – Turborepo build
4. Deploy web to Vercel (on `main` only)
5. Trigger EAS Build (on `main` only)

### Workflow: `dev-build.yml` (Development Build)

Triggered manually or on push to `develop`.

Builds a development APK/IPA for internal testing.

---

## 🔧 Environment Configuration

See [ENVIRONMENT.md](./ENVIRONMENT.md) for a complete reference of all environment variables.

### Production Checklist

Before deploying to production, verify:

- [ ] `SUPABASE_URL` points to production project
- [ ] `SUPABASE_ANON_KEY` is the production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (server-side only, never expose to client)
- [ ] `MAPBOX_TOKEN` is configured (for dispatcher map)
- [ ] RLS policies are applied to the database
- [ ] Demo seed data is **not** in production (or is clearly marked)
- [ ] Sentry DSN is configured for error tracking
- [ ] EAS project slug matches `app.json`

---

## 📚 Additional Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
