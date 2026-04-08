# Field Service App – Architecture Guide

Detailed description of the Field Service application architecture.

## 🏗️ Monorepo Structure

```
field-service/
├── apps/
│   ├── mobile/              # Expo application (React Native)
│   │   ├── app/             # Expo Router (file-based routing)
│   │   │   ├── (auth)/      # Auth flow (login)
│   │   │   ├── (tabs)/      # Tab navigation (home, tasks, reports, profile)
│   │   │   └── tasks/       # Task detail screen
│   │   ├── lib/             # Utility functions
│   │   │   ├── auth-context.tsx    # Auth provider
│   │   │   └── supabase.ts         # Supabase client
│   │   └── package.json
│   │
│   └── web/                 # Next.js application (Web Dashboard)
│       ├── app/             # Next.js App Router
│       │   ├── (auth)/      # Auth flow (login)
│       │   ├── (dashboard)/ # Protected dashboard
│       │   │   ├── page.tsx        # Dashboard overview
│       │   │   ├── tasks/          # Task management
│       │   │   └── technicians/    # Technician management
│       │   ├── layout.tsx          # Root layout
│       │   └── middleware.ts       # Protected routes middleware
│       ├── components/      # Reusable components
│       ├── lib/             # Utility functions
│       └── package.json
│
├── packages/
│   ├── shared-types/        # TypeScript interfaces
│   │   └── index.ts         # Task, Technician, Report, Location, User, Part
│   │
│   └── db/                  # Database & ORM
│       ├── schema.ts        # Drizzle ORM schemas
│       ├── seed.ts          # Demo data
│       ├── rls-policies.sql # Row Level Security policies
│       ├── drizzle.config.ts
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml           # Main CI/CD pipeline
│       └── dev-build.yml    # Development build workflow
│
├── docs/
│   ├── SETUP.md             # Setup guide
│   └── ARCHITECTURE.md      # This file
│
├── PLAN.md                  # Detailed implementation plan
├── README.md                # Project overview
├── turbo.json               # Turborepo config
├── pnpm-workspace.yaml      # pnpm workspaces
├── tsconfig.json            # Root TypeScript config
└── docker-compose.yml       # PostgreSQL for local dev
```

## 🔄 Data Flow Architecture

### Mobile App (Offline-First)

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UI Layer (React Components)             │  │
│  │  - Login Screen                                      │  │
│  │  - Task List (FlatList)                             │  │
│  │  - Task Detail                                       │  │
│  │  - Report Builder                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         State Management (TanStack Query)            │  │
│  │  - Server state caching                             │  │
│  │  - Optimistic updates                               │  │
│  │  - Background sync                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Offline-First Layer (Custom Hooks)             │  │
│  │  - useOfflineSync()                                 │  │
│  │  - useNetworkStatus()                               │  │
│  │  - Sync queue management                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Local Storage (SQLite + FileSystem)          │  │
│  │  - expo-sqlite: Tasks, Reports, Sync Queue          │  │
│  │  - expo-file-system: Photos, PDFs                   │  │
│  │  - expo-secure-store: Auth tokens                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Network Layer (Supabase Client)              │  │
│  │  - REST API calls                                    │  │
│  │  - Real-time subscriptions                          │  │
│  │  - File uploads                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↕
                    ┌──────────┐
                    │ Supabase │
                    │ (Backend)│
                    └──────────┘
```

### Web Dashboard (Real-Time)

```
┌─────────────────────────────────────────────────────────────┐
│                  Web Dashboard (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UI Layer (React Components)             │  │
│  │  - Login Page                                        │  │
│  │  - Dashboard Overview                               │  │
│  │  - Task Management Table                            │  │
│  │  - Technician List                                  │  │
│  │  - Map View (Mapbox)                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         State Management (TanStack Query)            │  │
│  │  - Server state caching                             │  │
│  │  - Real-time subscriptions                          │  │
│  │  - Automatic refetching                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Network Layer (Supabase Client)              │  │
│  │  - REST API calls                                    │  │
│  │  - Real-time subscriptions (WebSocket)              │  │
│  │  - File uploads                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↕
                    ┌──────────┐
                    │ Supabase │
                    │ (Backend)│
                    └──────────┘
```

## 🗄️ Database Schema

### Tables

```sql
-- Users (Technicians & Dispatchers)
users
├── id (UUID, PK)
├── email (TEXT, UNIQUE)
├── role (TEXT: 'technician' | 'dispatcher')
├── name (TEXT)
├── phone (TEXT)
├── avatar_url (TEXT)
├── is_online (BOOLEAN)
├── last_location_lat (NUMERIC)
├── last_location_lng (NUMERIC)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Tasks
tasks
├── id (UUID, PK)
├── title (TEXT)
├── description (TEXT)
├── address (TEXT)
├── latitude (NUMERIC)
├── longitude (NUMERIC)
├── status (TEXT: 'assigned' | 'in_progress' | 'completed')
├── priority (TEXT: 'low' | 'medium' | 'high' | 'urgent')
├── category (TEXT: 'repair' | 'installation' | 'maintenance' | 'inspection')
├── due_date (TIMESTAMP)
├── customer_name (TEXT)
├── customer_phone (TEXT)
├── estimated_time (INTEGER, minutes)
├── technician_id (UUID, FK → users)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Reports
reports
├── id (UUID, PK)
├── task_id (UUID, FK → tasks)
├── status (TEXT: 'draft' | 'completed' | 'synced')
├── photos (TEXT[], URLs)
├── form_data (JSONB, dynamic form data)
├── signature (TEXT, SVG/PNG base64)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Locations (GPS tracking)
locations
├── id (UUID, PK)
├── technician_id (UUID, FK → users)
├── latitude (NUMERIC)
├── longitude (NUMERIC)
├── accuracy (NUMERIC, meters)
├── timestamp (TIMESTAMP)
└── created_at (TIMESTAMP)

-- Parts (Inventory)
parts
├── id (UUID, PK)
├── name (TEXT)
├── description (TEXT)
├── barcode (TEXT, UNIQUE)
├── price (NUMERIC)
├── stock (INTEGER)
├── category (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Sync Queue (Offline changes)
sync_queue
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── type (TEXT: 'task' | 'report' | 'location')
├── action (TEXT: 'create' | 'update' | 'delete')
├── data (JSONB)
├── version (INTEGER)
├── status (TEXT: 'pending' | 'synced' | 'failed')
├── error (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

### Row Level Security (RLS)

```
Users Table:
├── Users see their own profile
└── Dispatchers see all technicians

Tasks Table:
├── Technicians see only their assigned tasks
└── Dispatchers see all tasks

Reports Table:
├── Technicians see reports for their tasks
└── Dispatchers see all reports

Locations Table:
├── Technicians see their own location
└── Dispatchers see all locations

Parts Table:
├── Everyone can view parts
└── Only dispatchers can manage parts

Sync Queue Table:
└── Users see only their own queue
```

## 🔐 Authentication Flow

### Mobile App

```
┌─────────────────────────────────────────────────────────┐
│                    Login Screen                         │
│  - Email input                                          │
│  - Password input                                       │
│  - Demo credentials pre-filled                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Supabase Auth.signInWithPassword()          │
│  - Email and password validation (Zod)                  │
│  - Send to Supabase                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Secure Token Storage                       │
│  - expo-secure-store.setItemAsync('auth_session')       │
│  - Store JWT token                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Auth Context Update                        │
│  - setUser(userData)                                    │
│  - isSignedIn = true                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Protected Routes                           │
│  - Expo Router middleware in _layout.tsx                │
│  - Redirect to (tabs) if authenticated                  │
└─────────────────────────────────────────────────────────┘
```

### Web Dashboard

```
┌─────────────────────────────────────────────────────────┐
│                    Login Page                           │
│  - Email input                                          │
│  - Password input                                       │
│  - Demo credentials pre-filled                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Supabase Auth.signInWithPassword()          │
│  - Email and password validation (Zod)                  │
│  - Send to Supabase                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Auth Context Update                        │
│  - setUser(userData)                                    │
│  - Store in cookies                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Protected Routes Middleware                │
│  - apps/web/app/middleware.ts                           │
│  - Check auth token in cookies                          │
│  - Redirect to login if not authenticated               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Dashboard Access                           │
│  - Redirect to /dashboard                               │
│  - Role-based access (dispatcher)                       │
└─────────────────────────────────────────────────────────┘
```

## 🔄 Synchronization Flow (Offline-First)

```
ONLINE STATE:
┌──────────────────────────────────────────────────────────┐
│  Pull Sync (Background)                                  │
│  1. Fetch changes from server (delta sync)               │
│  2. Update local SQLite                                  │
│  3. Invalidate TanStack Query cache                      │
│  4. UI updates automatically                             │
└──────────────────────────────────────────────────────────┘

OFFLINE STATE:
┌──────────────────────────────────────────────────────────┐
│  Local Changes                                           │
│  1. User makes changes (create/update/delete)            │
│  2. Changes saved to local SQLite                        │
│  3. Changes added to sync_queue                          │
│  4. UI updates optimistically                            │
│  5. Offline banner shown                                 │
└──────────────────────────────────────────────────────────┘

TRANSITION OFFLINE → ONLINE:
┌──────────────────────────────────────────────────────────┐
│  Push Sync                                               │
│  1. Detect network status change                         │
│  2. Fetch sync_queue items                               │
│  3. Send to server (POST /api/sync/push)                 │
│  4. Server validates & applies changes                   │
│  5. Handle conflicts (last write wins)                   │
│  6. Clear sync_queue                                     │
│  7. Pull latest data from server                         │
│  8. Update local SQLite                                  │
│  9. Invalidate TanStack Query cache                      │
│  10. UI updates with server data                         │
└──────────────────────────────────────────────────────────┘
```

## 🚀 CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Push (main/develop)                 │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┬─────────────────┐
        ↓                 ↓                 ↓
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │  Lint   │      │TypeCheck │      │  Build   │
   │ (ESLint)│      │(TypeScript)      │(Turborepo)
   └─────────┘      └──────────┘      └──────────┘
        ↓                 ↓                 ↓
        └─────────────────┬─────────────────┘
                          ↓
        ┌─────────────────┬─────────────────┐
        ↓                 ↓
   ┌──────────────┐  ┌──────────────┐
   │Deploy Web    │  │EAS Build     │
   │(Vercel)      │  │(Mobile)      │
   └──────────────┘  └──────────────┘
```

## 📦 Shared Types

```typescript
// packages/shared-types/index.ts

export interface Task {
  id: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'repair' | 'installation' | 'maintenance' | 'inspection';
  due_date: string;
  customer_name: string;
  customer_phone: string;
  estimated_time: number;
  technician_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'technician' | 'dispatcher';
  avatar_url: string | null;
  is_online: boolean;
  last_location: { latitude: number; longitude: number } | null;
  created_at: string;
}

export interface Report {
  id: string;
  task_id: string;
  status: 'draft' | 'completed' | 'synced';
  photos: string[];
  form_data: Record<string, unknown>;
  signature: string | null;
  created_at: string;
  updated_at: string;
}

// ... more types
```

## 🎯 Key Design Decisions

### 1. Offline-First Architecture

- **Why:** Technicians work in the field without stable internet
- **How:** SQLite for local storage, sync queue for changes, delta sync
- **Benefit:** App works without internet, data syncs automatically

### 2. Monorepo (Turborepo + pnpm)

- **Why:** Share code between mobile and web (types, utils)
- **How:** Workspace structure, shared-types package
- **Benefit:** DRY principle, consistent API, easier maintenance

### 3. Type Safety (TypeScript + Zod)

- **Why:** Prevent runtime errors, better DX
- **How:** Strict TypeScript mode, Zod validation on both sides
- **Benefit:** Fewer bugs, better IDE support, code as documentation

### 4. Real-Time Updates (Supabase Realtime)

- **Why:** Dispatcher sees live status of technicians and tasks
- **How:** WebSocket subscriptions, TanStack Query integration
- **Benefit:** Instant updates without polling

### 5. Row Level Security (RLS)

- **Why:** Data security, technicians see only their tasks
- **How:** Supabase RLS policies at database level
- **Benefit:** Security at database level, cannot be bypassed

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Turborepo Documentation](https://turbo.build/repo/docs)
