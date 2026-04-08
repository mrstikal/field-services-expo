# Field Service App

A modern, full-stack field service management application built with Expo (React Native) and Next.js. Designed for technicians to manage tasks in the field and dispatchers to coordinate operations from the office.

## 🎯 Features

- **Mobile App (Technician):** Task management, offline-first local storage, GPS capture, photo documentation, digital signatures
- **Web Dashboard (Dispatcher):** Task assignment, technician lookup, team management, dashboard analytics
- **Offline Sync:** Local queue, push-before-pull sync, tombstones for deletions, local conflict recording
- **Auth:** Real Supabase sessions on web and mobile, with role checks backed by the `users` table
- **Type-Safe:** Full TypeScript with shared Zod validation at the API boundary
- **Modern Stack:** Expo, Next.js, Turborepo, Drizzle ORM, TanStack Query

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Supabase project with PostgreSQL database

### Setup

```bash
# 1. Clone repository
git clone https://github.com/mrstikal/field-services-expo.git
cd field-service

# 2. Configure environment
cp env.local.example env.local
# Edit env.local with your Supabase credentials:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_KEY

# 3. Install dependencies and reset demo database
pnpm setup
# This will:
# - Approve required build scripts (sharp, sqlite3, esbuild, etc.)
# - Install all dependencies
# - Reset Supabase database with demo data

# 4. Start development
pnpm dev:all
```

**Demo Credentials:**

| Role       | Email               | Password |
| ---------- | ------------------- | -------- |
| Dispatcher | dispatcher1@demo.cz | demo123  |
| Dispatcher | dispatcher2@demo.cz | demo123  |
| Technician | technik1@demo.cz    | demo123  |
| Technician | technik2@demo.cz    | demo123  |
| Technician | technik3@demo.cz    | demo123  |
| Technician | technik4@demo.cz    | demo123  |
| Technician | technik5@demo.cz    | demo123  |

> **Note:** `pnpm demo:reset` creates or updates the Supabase Auth demo users and aligns `public.users.id` with `auth.users.id`.

### Available Commands

```bash
pnpm dev:all          # Start web + mobile Metro from repo root
pnpm --filter field-service-web dev     # Start only the web app
pnpm --filter field-service-mobile dev  # Start only the mobile Expo dev server
pnpm mobile:metro:usb # Start mobile Metro for USB Android workflow
pnpm build            # Build all apps
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript type checking
pnpm run test:unit    # Run all unit tests (shared + mobile + web)
pnpm run test:integration # Run integration tests (mobile + web)
pnpm run test:e2e     # Run default portable E2E (web Playwright)
pnpm run test:e2e:web # Run Playwright web E2E explicitly
pnpm run test:e2e:web:reset # Destructive demo reset + Playwright web baseline run
pnpm run test:e2e:mobile # Run Maestro mobile E2E
pnpm run test:e2e:full # Run mobile Maestro + web Playwright E2E
pnpm run test:all     # Run unit + integration + default E2E
pnpm format           # Format code with Prettier
pnpm db:seed          # Seed database with demo data
pnpm demo:reset       # Reset Supabase database with demo data
pnpm approve-builds   # Approve build scripts for dependencies
```

For detailed setup instructions, see [SETUP.md](./docs/SETUP.md).  
For daily development on Windows + Android USB, see [DAILY_RUN.md](./docs/DAILY_RUN.md).

## 📚 Documentation

| Document                                           | Description                                              |
| -------------------------------------------------- | -------------------------------------------------------- |
| **[Setup Guide](./docs/SETUP.md)**                 | Installation, configuration, and running the apps        |
| **[Architecture Guide](./docs/ARCHITECTURE.md)**   | System design, data flow, and technical decisions        |
| **[Features](./docs/FEATURES.md)**                 | Detailed description of all app features                 |
| **[Database Setup](./docs/DATABASE_SETUP.md)**     | RLS policies, seeding, and database management           |
| **[Environment Variables](./docs/ENVIRONMENT.md)** | Complete reference for all env variables                 |
| **[Deployment Guide](./docs/DEPLOYMENT.md)**       | EAS Build, Vercel, OTA updates, CI/CD                    |
| **[Daily Run](./docs/DAILY_RUN.md)**               | Daily startup flow for Windows + Android USB             |
| **[Testing Guide](./docs/TESTING.md)**             | Test commands, native-only suites, and E2E prerequisites |
| **[Implementation Plan](./PLAN.md)**               | Detailed roadmap for all 8 development stages (in Czech) |

## 🏗️ Project Structure

```
field-service/
├── apps/
│   ├── mobile/              # Expo app (React Native)
│   └── web/                 # Next.js dashboard
├── packages/
│   ├── shared-types/        # TypeScript interfaces
│   └── db/                  # Database & ORM (Drizzle, schema, seed, RLS)
├── docs/                    # Documentation
├── scripts/                 # Utility scripts (reset-supabase.mjs)
├── android/                 # Android native build files
├── .github/workflows/       # CI/CD pipelines (ci.yml, dev-build.yml)
├── docker-compose.yml       # PostgreSQL for local development
├── env.local.example        # Environment variables template
└── PLAN.md                  # Implementation plan (Czech)
```

## 🛠️ Tech Stack

### Mobile (Expo)

- **Framework:** Expo SDK 52, React Native 0.76
- **Navigation:** Expo Router (file-based)
- **State:** TanStack Query, Zustand
- **Forms:** React Hook Form + Zod
- **Offline:** expo-sqlite, local sync queue, local conflict table
- **Animations:** React Native Reanimated, Gesture Handler
- **Native:** Camera, Location, FileSystem, Secure Store, Print, Sharing
- **Styling:** NativeWind + Tailwind CSS

### Web (Next.js)

- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS
- **State:** TanStack Query
- **Forms:** React Hook Form + Zod
- **Maps:** Mapbox GL JS / react-map-gl
- **Auth:** Supabase Auth

### Backend

- **Database:** PostgreSQL (Supabase)
- **ORM:** Drizzle ORM
- **Auth:** Supabase Auth with RLS
- **Real-time:** Supabase Realtime
- **Storage:** Supabase Storage

### DevOps

- **Monorepo:** Turborepo + pnpm
- **CI/CD:** GitHub Actions
- **Mobile Deploy:** EAS Build + EAS Update (OTA)
- **Web Deploy:** Vercel
- **Linting:** ESLint + Prettier
- **Type Check:** TypeScript strict mode

## 📱 Mobile App Features

- **Task Management:** View assigned tasks, filter by status/priority
- **Offline-First:** Work without internet, sync local changes when online
- **GPS Tracking:** Background location capture persisted into local storage and sync queue
- **Photo Documentation:** Capture and attach photos to tasks
- **Digital Signatures:** Collect customer signatures on reports
- **PDF Reports:** Generate and share task reports
- **Barcode Scanning:** Scan parts and inventory items

See [FEATURES.md](./docs/FEATURES.md) for full details.

## 💻 Web Dashboard Features

- **Dashboard:** Task statistics and technician status
- **Task Management:** Create, assign, and track tasks
- **Technician Tracking:** See technician locations on map
- **Team Management:** Manage technician profiles and availability
- **Analytics:** Task completion rates, performance metrics
- **Role-Based Access:** Separate views for dispatchers and admins

See [FEATURES.md](./docs/FEATURES.md) for full details.

## 🔐 Security

- **Row Level Security (RLS):** Database-level access control tied to `users.role`
- **Secure Auth:** Supabase session tokens with secure storage on mobile
- **Type Safety:** TypeScript strict mode + Zod validation
- **Protected Routes:** Middleware-based route protection
- **Encrypted Storage:** Secure token storage on mobile

## 🔧 Environment Variables

Key variables required in `env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key        # server-side only!

MAPBOX_TOKEN=your-mapbox-token               # optional, for dispatcher map
SENTRY_DSN=your-sentry-dsn                   # optional, for error tracking

EXPO_PUBLIC_API_URL=http://localhost:3000     # mobile → web API URL
DATABASE_URL=postgresql://...                # local Docker PostgreSQL
```

See [ENVIRONMENT.md](./docs/ENVIRONMENT.md) for the complete reference.

## 🧪 Testing

Use root grouped commands:

```bash
pnpm run test:shared
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run test:e2e:mobile
pnpm run test:e2e:full
pnpm run test:all
```

`pnpm run test:e2e` is the portable default and runs only web Playwright. Mobile E2E is available separately via `pnpm run test:e2e:mobile`.

Some Expo-native mobile suites are excluded from default jsdom runs and must be run explicitly with `EXPO_NATIVE_TESTS=1`.

See [TESTING.md](./docs/TESTING.md) for full details and PowerShell examples.

## 🚀 Deployment

### Mobile (EAS Build)

```bash
cd apps/mobile
eas build --platform all --profile production
eas update --branch production               # OTA update (no App Store review)
```

### Web (Vercel)

```bash
cd apps/web
vercel deploy --prod
```

Or use GitHub Actions for automated deployment (see `.github/workflows/ci.yml`).

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the complete deployment guide.

## 📊 Development Stages

The project is organized into 8 development stages:

| Stage | Description                                                                   | Status                   |
| ----- | ----------------------------------------------------------------------------- | ------------------------ |
| 1     | **Monorepo & Infrastructure** – Turborepo, Expo, Next.js setup                | ✅ Implemented           |
| 2     | **Authentication & Navigation** – Auth flows, protected routes                | ✅ Implemented           |
| 3     | **Offline-First Engine** – SQLite, sync queue, tombstones, conflict recording | 🟡 Implemented core flow |
| 4     | **Task Management** – CRUD operations, UI components                          | 🟡 Implemented core flow |
| 5     | **Native Capabilities** – Camera, location, PDF generation                    | 🟡 Partial / prototype   |
| 6     | **Smart Report Builder** – Dynamic forms, digital signatures                  | 🟡 Partial / prototype   |
| 7     | **Polish & Performance** – Error handling, optimization                       | 🟡 Ongoing               |
| 8     | **Build & Deployment** – EAS Build, OTA updates, documentation                | 🟡 In progress           |

See [PLAN.md](./PLAN.md) for the detailed implementation plan (in Czech).

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am 'Add my feature'`
3. Push branch: `git push origin feature/my-feature`
4. Create a Pull Request

## 📝 License

MIT

## 🙋 Support

For questions or issues:

- Check the [Setup Guide](./docs/SETUP.md) for common problems
- Review the [Architecture Guide](./docs/ARCHITECTURE.md) for system design
- See [DAILY_RUN.md](./docs/DAILY_RUN.md) for Windows + Android USB workflow
- See [PLAN.md](./PLAN.md) for implementation details

## 🎓 Key Technologies

- **Expo** – Cross-platform mobile development
- **Next.js** – React framework for web
- **Turborepo** – Monorepo orchestration
- **Drizzle ORM** – Type-safe database access
- **TanStack Query** – Server state management
- **Supabase** – Backend-as-a-Service (DB, Auth, Realtime, Storage)
- **TypeScript** – Type safety
- **Tailwind CSS** – Utility-first styling
- **EAS Build** – Cloud mobile builds
- **EAS Update** – Over-the-Air updates

---

Built for field service teams
