# Field Service App

A modern, full-stack field service management application built with Expo (React Native) and Next.js. Designed for technicians to manage tasks in the field and dispatchers to coordinate operations from the office.

## 🎯 Features

- **Mobile App (Technician):** Task management, offline-first sync, GPS tracking, photo documentation, digital signatures
- **Web Dashboard (Dispatcher):** Real-time task assignment, technician tracking, team management, analytics
- **Offline-First:** Works seamlessly without internet, syncs automatically when online
- **Real-Time Updates:** Live status updates using Supabase Realtime
- **Type-Safe:** Full TypeScript with Zod validation
- **Modern Stack:** Expo, Next.js, Turborepo, Drizzle ORM, TanStack Query

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/field-service.git
cd field-service
pnpm install

# 2. Set up environment
cp env.local.example env.local
# Edit env.local with your Supabase credentials

# 3. Start development
pnpm dev
```

**Demo Credentials:**
- Technician: `technik1@demo.cz` / `demo123`
- Dispatcher: `dispatcher1@demo.cz` / `demo123`

For detailed setup instructions, see [SETUP.md](./docs/SETUP.md).

## 📚 Documentation

- **[Setup Guide](./docs/SETUP.md)** – Installation, configuration, and running the apps
- **[Architecture Guide](./docs/ARCHITECTURE.md)** – System design, data flow, and technical decisions
- **[Implementation Plan](./PLAN.md)** – Detailed roadmap for all 8 development stages (in Czech)

## 🏗️ Project Structure

```
field-service/
├── apps/
│   ├── mobile/              # Expo app (React Native)
│   └── web/                 # Next.js dashboard
├── packages/
│   ├── shared-types/        # TypeScript interfaces
│   └── db/                  # Database & ORM
├── docs/                    # Documentation
├── .github/workflows/       # CI/CD pipelines
└── PLAN.md                  # Implementation plan
```

## 🛠️ Tech Stack

### Mobile (Expo)
- **Framework:** Expo SDK 52, React Native 0.76
- **Navigation:** Expo Router (file-based)
- **State:** TanStack Query, Zustand
- **Forms:** React Hook Form + Zod
- **Offline:** expo-sqlite, sync queue
- **Native:** Camera, Location, FileSystem, Secure Store

### Web (Next.js)
- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS
- **State:** TanStack Query
- **Forms:** React Hook Form + Zod
- **Maps:** Mapbox GL JS
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
- **Mobile Deploy:** EAS Build
- **Web Deploy:** Vercel
- **Linting:** ESLint + Prettier
- **Type Check:** TypeScript strict mode

## 📱 Mobile App Features

- **Task Management:** View assigned tasks, filter by status/priority
- **Offline-First:** Work without internet, auto-sync when online
- **GPS Tracking:** Background location tracking with geofencing
- **Photo Documentation:** Capture and attach photos to tasks
- **Digital Signatures:** Collect customer signatures on reports
- **PDF Reports:** Generate and share task reports
- **Barcode Scanning:** Scan parts and inventory items

## 💻 Web Dashboard Features

- **Real-Time Dashboard:** Live statistics and technician status
- **Task Management:** Create, assign, and track tasks
- **Technician Tracking:** See technician locations on map
- **Team Management:** Manage technician profiles and availability
- **Analytics:** Task completion rates, performance metrics
- **Role-Based Access:** Separate views for dispatchers and admins

## 🔐 Security

- **Row Level Security (RLS):** Database-level access control
- **Secure Auth:** JWT tokens with secure storage
- **Type Safety:** TypeScript strict mode + Zod validation
- **Protected Routes:** Middleware-based route protection
- **Encrypted Storage:** Secure token storage on mobile

## 🚀 Deployment

### Mobile
```bash
cd apps/mobile
eas build --platform all --profile production
eas update --branch production
```

### Web
```bash
cd apps/web
vercel deploy --prod
```

Or use GitHub Actions for automated deployment (see `.github/workflows/ci.yml`).

## 📊 Development Stages

The project is organized into 8 development stages:

1. **Monorepo & Infrastructure** – Turborepo, Expo, Next.js setup
2. **Authentication & Navigation** – Auth flows, protected routes
3. **Offline-First Engine** – SQLite, sync queue, conflict resolution
4. **Task Management** – CRUD operations, UI components
5. **Native Capabilities** – Camera, location, PDF generation
6. **Smart Report Builder** – Dynamic forms, digital signatures
7. **Polish & Performance** – Error handling, optimization
8. **Build & Deployment** – EAS Build, OTA updates, documentation

See [PLAN.md](./PLAN.md) for detailed implementation plan (in Czech).

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
- See [PLAN.md](./PLAN.md) for implementation details

## 🎓 Key Technologies

- **Expo** – Cross-platform mobile development
- **Next.js** – React framework for web
- **Turborepo** – Monorepo orchestration
- **Drizzle ORM** – Type-safe database access
- **TanStack Query** – Server state management
- **Supabase** – Backend-as-a-Service
- **TypeScript** – Type safety
- **Tailwind CSS** – Utility-first styling

---

Built with ❤️ for field service teams
