# Field Service App – Environment Variables

Complete reference for all environment variables used in the Field Service application.

## 📄 Setup

Copy the example file and fill in your values:

```bash
cp env.local.example env.local
```

The root `env.local` file is shared across all apps in the monorepo. Individual apps may also have their own `.env.local` files for app-specific overrides.

---

## 🔑 Required Variables

These variables must be set for the application to function.

### Supabase

| Variable               | Description                          | Example                      |
| ---------------------- | ------------------------------------ | ---------------------------- |
| `SUPABASE_URL`         | Supabase project URL                 | `https://abcdef.supabase.co` |
| `SUPABASE_ANON_KEY`    | Public anon key (safe for client)    | `eyJhbGci...`                |
| `SUPABASE_SERVICE_KEY` | Service role key (server-side only!) | `eyJhbGci...`                |

> ⚠️ **Security:** Never expose `SUPABASE_SERVICE_KEY` to the client. It bypasses Row Level Security.

Where to find these values:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API**
4. Copy **Project URL**, **anon public** key, and **service_role** key

---

## 🔧 Optional Variables

### Mapbox (Dispatcher Map)

| Variable       | Description                | Example          |
| -------------- | -------------------------- | ---------------- |
| `MAPBOX_TOKEN` | Mapbox public access token | `pk.eyJ1Ijoi...` |

Required for the technician map view in the web dashboard. Without it, the map will not render.

Get your token at [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens).

### Sentry (Error Tracking)

| Variable     | Description             | Example                                 |
| ------------ | ----------------------- | --------------------------------------- |
| `SENTRY_DSN` | Sentry Data Source Name | `https://abc@o123.ingest.sentry.io/456` |

Required for crash reporting and error tracking in both mobile and web apps.

Get your DSN at [sentry.io](https://sentry.io) → Project → Settings → Client Keys (DSN).

---

## 📱 Mobile App Variables

These variables are used by the Expo mobile app. Variables prefixed with `EXPO_PUBLIC_` are bundled into the app and visible to the client.

| Variable               | Description             | Default                 |
| ---------------------- | ----------------------- | ----------------------- |
| `EXPO_PUBLIC_APP_NAME` | Display name of the app | `Field Service`         |
| `EXPO_PUBLIC_API_URL`  | Base URL of the web API | `http://localhost:3000` |

> **Note:** For USB development on Android, `EXPO_PUBLIC_API_URL` must point to your local machine's IP or use `http://localhost:3000` with ADB reverse port forwarding. See [DAILY_RUN.md](./DAILY_RUN.md).

The mobile app also reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the root `env.local`.

---

## 🗄️ Database Variables

| Variable       | Description                  | Example                                                       |
| -------------- | ---------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/field_service` |

Used by Drizzle ORM for local development with Docker PostgreSQL. Not needed when using Supabase directly.

For local Docker setup:

```bash
# Start PostgreSQL
docker-compose up -d

# DATABASE_URL for docker-compose.yml defaults:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/field_service
```

---

## 📋 Complete `env.local.example`

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# Mapbox Configuration (Optional - for dispatcher map)
MAPBOX_TOKEN=your-mapbox-token-here

# Sentry Configuration (Optional - for error tracking)
SENTRY_DSN=your-sentry-dsn-here

# App Configuration
EXPO_PUBLIC_APP_NAME=Field Service
EXPO_PUBLIC_API_URL=http://localhost:3000

# Database Configuration (for local development with Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/field_service
```

---

## 🚀 Per-Environment Configuration

### Development (local)

```env
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_KEY=your-dev-service-key
EXPO_PUBLIC_API_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/field_service
```

### Staging / Preview

```env
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_KEY=your-staging-service-key
EXPO_PUBLIC_API_URL=https://staging.your-domain.com
```

### Production

```env
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_KEY=your-prod-service-key
MAPBOX_TOKEN=your-mapbox-token
SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_API_URL=https://your-domain.com
```

---

## 🔐 Security Notes

1. **Never commit `env.local`** – it is listed in `.gitignore`
2. **`SUPABASE_SERVICE_KEY` is sensitive** – it bypasses RLS; use only in server-side code
3. **`EXPO_PUBLIC_*` variables are public** – they are bundled into the mobile app binary; never put secrets in them
4. **Rotate keys** if they are accidentally exposed
5. **Use separate Supabase projects** for development, staging, and production

---

## 🔗 Related Documentation

- [Setup Guide](./SETUP.md) – Installation and configuration
- [Database Setup](./DATABASE_SETUP.md) – Database initialization and seeding
- [Deployment Guide](./DEPLOYMENT.md) – Production deployment
