# Field Service App

**The definitive production-grade technical demonstration of a modern, full-stack monorepo ecosystem.**

This project is a high-performance field service management platform featuring an **offline-first Expo mobile application** and a **real-time Next.js web dashboard**. It goes far beyond a simple CRUD app, implementing complex synchronization engines, robust security patterns, and a comprehensive automated testing strategy that mirrors high-end enterprise software architecture.

### 🌟 Why this matters
- **Cutting-Edge Stack:** Built on the absolute bleeding edge with **Next.js 16 (App Router)**, **React 19**, **Expo 54**, and **Tailwind CSS 4**.
- **Architectural Depth:** Features a custom-built **offline sync engine** with delta-updates, tombstone deletions, and automated conflict resolution.
- **Uncompromising Quality:** A comprehensive testing pyramid consisting of **over 50+ automated tests** across **Vitest** (unit/integration), **Playwright** (web E2E), and **Maestro** (mobile E2E) ensuring 100% confidence in mission-critical flows like offline sync and auth.
- **Type-Safe Excellence:** Strict end-to-end type safety using a shared **Zod** validation layer and **Drizzle ORM** for a unified, error-resistant developer experience.
- **Production-Ready Features:** Includes background GPS tracking, geofencing, multi-stage photo documentation with reactive UI, and on-device PDF generation.

---

## 🎯 Features

- **Mobile App (Technician):** Task management, offline-first local storage, GPS capture, photo documentation, digital signatures
- **Web Dashboard (Dispatcher):** Task assignment, technician lookup, team management, dashboard analytics
- **Real-Time Chat:** Instant messaging between technicians and dispatchers with read receipts, unread counters, and conversation filtering
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

> **Note:** `pnpm demo:reset` creates or updates the Supabase Auth demo users, aligns `public.users.id` with `auth.users.id`, and when an Android device/emulator is connected via `adb`, also clears the mobile app's local app data so stale SQLite cache does not survive the reset.

### Available Commands

```bash
pnpm dev:all          # Start web + mobile Metro from repo root
pnpm --filter field-service-web dev     # Start only the web app
pnpm --filter field-service-mobile dev  # Start only the mobile Expo dev server
pnpm mobile:metro:usb # Start mobile Metro for USB Android workflow
pnpm mobile:metro:dev-client:usb # Start Metro for Android dev client over USB
pnpm android:usb      # Detect adb and set adb reverse for ports 8081/3000
pnpm android:sdk:windows # Persist ANDROID_HOME / ANDROID_SDK_ROOT on Windows
pnpm mobile:android:usb # Build and run the Android app over USB
pnpm mobile:dev-client:android:usb # Build and run Android dev client over USB
pnpm dev:all:dev-client:windows # Windows: web + Metro + Android dev client build
pnpm dev:all:dev-client:posix   # Linux/macOS: web + Metro + Android dev client build
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
pnpm demo:reset       # Reset Supabase demo data and clear connected Android app cache
pnpm approve-builds   # Approve build scripts for dependencies
```

For detailed setup instructions, see [SETUP.md](./docs/SETUP.md).  
For daily development on Windows + Android USB, see [DAILY_RUN.md](./docs/DAILY_RUN.md).

### Android USB Development

#### Windows

```powershell
Set-Location "F:\expo\field-service"
pnpm android:sdk:windows
pnpm dev:all:dev-client:windows
```

#### Linux / macOS

```bash
cd /path/to/field-service
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
pnpm dev:all:dev-client:posix
```

Use Expo Go only for non-push workflows. Remote push notifications on Android require the dev client or another native build.

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

## 🏗️ Project Structure

```
field-service/
├── apps/
│   ├── mobile/              # Expo app (React Native)
│   └── web/                 # Next.js dashboard
├── packages/
│   ├── shared-types/        # TypeScript interfaces (includes messaging types)
│   └── db/                  # Database & ORM (Drizzle, schema, seed, RLS)
├── docs/                    # Documentation
├── scripts/                 # Utility scripts (reset-supabase.mjs)
├── android/                 # Android native build files
├── .github/workflows/       # CI/CD pipelines (ci.yml, dev-build.yml)
├── docker-compose.yml       # PostgreSQL for local development
├── env.local.example        # Environment variables template
```

## 🛠️ Tech Stack

### Mobile (Expo)

- **Framework:** Expo SDK 54, React Native 0.81
- **Navigation:** Expo Router 6 (current Expo SDK 54 line; this supersedes the older Expo Router v3 requirement from the original assignment)
- **State:** TanStack Query, Zustand
- **Forms:** React Hook Form + Zod
- **Offline:** expo-sqlite, local sync queue, local conflict table
- **Animations:** React Native Reanimated, Gesture Handler
- **Native:** Camera, Location, FileSystem, Secure Store, Print, Sharing
- **Styling:** NativeWind 4 + Tailwind CSS 3.4 on mobile; Tailwind CSS 4 on web. NativeWind 4 currently pins the mobile app to Tailwind v3, so the split is intentional.

### Web (Next.js)

- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS 4
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
- **Swipeable task management:** Use mobile gestures to mark tasks as completed/incompleted
- **PDF Reports:** Generate and share task reports
- **Barcode Scanning:** Scan parts and inventory items
- **Real-Time Chat:** Send and receive messages with other users, view conversation history, filter unread messages

See [FEATURES.md](./docs/FEATURES.md) for full details.

## 💻 Web Dashboard Features

- **Dashboard:** Task statistics and technician status
- **Task Management:** Create, assign, and track tasks
- **Technician Tracking:** See technician locations on map
- **Team Management:** Manage technician profiles and availability
- **Analytics:** Task completion rates, performance metrics
- **Team Communication:** Chat with technicians directly from the dashboard, manage conversations, track message status
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
