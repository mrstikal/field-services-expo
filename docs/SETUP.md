# Field Service App – Setup Guide

Complete installation and configuration guide for the Field Service application.

## 📋 Prerequisites

- **Node.js:** v20 or higher
- **pnpm:** v10.28.1 or higher
- **Git:** for cloning the repository
- **Docker:** for PostgreSQL (optional, can use Supabase)
- **Expo Account:** for EAS Build and deployment

## 🚀 Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/field-service.git
cd field-service

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp env.local.example env.local
# Edit env.local with your Supabase credentials

# 4. Run seed data (optional)
cd packages/db
pnpm seed
cd ../..

# 5. Start the applications
pnpm dev:all
```

## 📦 Installing Dependencies

### 1. Node.js and pnpm

```bash
# Verify Node.js version
node --version  # should be v20+

# Install pnpm (if you don't have it)
npm install -g pnpm@10.28.1

# Verify pnpm version
pnpm --version
```

### 2. Monorepo Setup

```bash
# Install all dependencies
pnpm install

# Verify Turborepo works
pnpm build
```

## 🗄️ Database Setup

### Option 1: Supabase (Recommended)

1. Go to https://supabase.com and create a new project
2. Copy the URL and API keys
3. Add to `env.local`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key
   ```

4. Apply RLS policies:
   ```bash
   psql -U postgres -d field_service -f packages/db/rls-policies.sql
   ```

5. Run seed data:
   ```bash
   cd packages/db
   pnpm seed
   ```

### Option 2: Local PostgreSQL (Docker)

```bash
# Start PostgreSQL in Docker
docker-compose up -d

# Verify it's running
docker ps | grep postgres

# Run migrations
cd packages/db
pnpm drizzle-kit push

# Run seed data
pnpm seed
```

## 🔐 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Mapbox (optional, for dispatcher map)
MAPBOX_TOKEN=your-mapbox-token

# Sentry (optional, for error tracking)
SENTRY_DSN=your-sentry-dsn

# App Config
EXPO_PUBLIC_APP_NAME="Field Service"
```

## 🏃 Running Applications

For daily development on Windows + Android USB, see [`docs/DAILY_RUN.md`](./DAILY_RUN.md).

### Mobile App (Expo)

```bash
# Start dev server
pnpm --filter field-service-mobile dev

# Or specific platform
pnpm --filter field-service-mobile android
pnpm --filter field-service-mobile ios
pnpm --filter field-service-mobile web
```

App opens at `http://localhost:8081`

**Demo Credentials:**
- Email: `technik1@demo.cz`
- Password: `demo123`

### Web Dashboard (Next.js)

```bash
# Start dev server
pnpm --filter field-service-web dev

# Or build for production
pnpm --filter field-service-web build
pnpm --filter field-service-web start
```

App opens at `http://localhost:3000`

**Demo Credentials:**
- Email: `dispatcher1@demo.cz`
- Password: `demo123`

## 🧪 Testing

### Lint & Format

```bash
# Run ESLint
pnpm lint

# Fix formatting
pnpm format

# Check formatting without changes
pnpm format --check
```

### TypeScript Type Check

```bash
# Verify types
pnpm typecheck
```

### Build

```bash
# Build all applications
pnpm build

# Or specific application
pnpm --filter field-service-mobile build
pnpm --filter field-service-web build
```

## 🚀 Deployment

### Web (Vercel)

```bash
# Connect Vercel project
vercel link

# Deploy
vercel deploy --prod
```

Or automatically via GitHub Actions (see `.github/workflows/ci.yml`)

### Mobile (EAS Build)

```bash
# Login to EAS
eas login

# Build for preview
cd apps/mobile
eas build --platform all --profile preview

# Build for production
eas build --platform all --profile production

# OTA Update
eas update --branch production
```

## 🔧 Troubleshooting

### "pnpm: command not found"

```bash
npm install -g pnpm@10.28.1
```

### "Cannot find module '@shared-types'"

```bash
# Reinstall dependencies
pnpm install

# Or clean cache
pnpm store prune
pnpm install
```

### "Supabase connection failed"

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
2. Verify you have internet connection
3. Verify Supabase project is active

### "Port 3000 is already in use"

```bash
# Run on different port
pnpm --filter field-service-web dev -- -p 3001
```

### "EAS Build failed"

```bash
# Verify you have EAS token
eas login

# Verify configuration
cat apps/mobile/eas.json

# Run with verbose logging
eas build --platform all --profile development --verbose
```

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [TanStack Query Documentation](https://tanstack.com/query/latest)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am 'Add my feature'`
3. Push branch: `git push origin feature/my-feature`
4. Create Pull Request

## 📝 License

MIT
