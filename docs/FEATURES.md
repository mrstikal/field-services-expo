# Field Service App – Features

Detailed description of all features available in the Field Service application.

## 📱 Mobile App (Technician)

The mobile app is built with Expo (React Native) and designed for field technicians.

### Authentication
- Email/password login with Zod validation
- Secure token storage via `expo-secure-store`
- Persistent session across app restarts
- Protected routes via Expo Router layout middleware
- Demo credentials pre-filled for quick access

### Task Management
- View all assigned tasks in a scrollable list (`FlatList` with optimized rendering)
- Dashboard with today's tasks and statistics (new, completed, overdue)
- Filter tasks by status, priority, date
- Task detail screen with full information:
  - Title, description, address, GPS coordinates
  - Customer name and phone number
  - Priority and status indicators (color-coded)
  - Estimated time
- Task status workflow: `assigned` → `in_progress` → `completed`
- Action buttons: Navigate (opens maps), Call customer, Start work
- Pull-to-refresh for manual sync

### Offline-First Architecture
- All tasks stored locally in SQLite (`expo-sqlite`)
- Works fully without internet connection
- Sync queue for changes made offline
- Automatic sync when connection is restored
- Optimistic UI updates
- Offline banner indicator
- Delta sync (only changed records are transferred)
- Conflict resolution: last-write-wins with version numbers

### GPS & Location Tracking
- Foreground location tracking
- Background location tracking via `expo-location` + TaskManager
- Geofencing: automatic task status change when arriving at job site (radius ~100m)
- Location history sent to server for dispatcher map view
- Battery-aware: reduced frequency at low battery

### Camera & Photo Documentation
- Capture photos directly within a report
- Multiple photos per report
- Image compression before saving (`expo-image-manipulator`)
- Local storage in `expo-file-system` (offline)
- Upload to Supabase Storage on sync

### Barcode Scanning
- Full-screen camera with overlay frame
- EAN/QR code detection
- Lookup scanned part in inventory database
- Haptic feedback on successful scan
- Permission handling with explanatory dialog
- Error boundary for unavailable camera

### Reports & PDF Generation
- Create service reports linked to tasks
- Dynamic form fields based on task type:
  - Text, number, checkbox, photo, dropdown
  - Conditional fields based on previous answers
- Digital customer signature (`react-native-signature-canvas`)
  - Signature saved as SVG/PNG
  - Embedded in PDF report
- PDF generation from HTML template (`expo-print`)
  - Company header, task details, photos, signature
- Share PDF via `expo-sharing` (email, WhatsApp, etc.)
- Report status: `draft` → `completed` → `synced`

### Profile
- View technician profile
- Online/offline status
- Last known location

---

## 💻 Web Dashboard (Dispatcher)

The web dashboard is built with Next.js and designed for dispatchers managing field operations.

### Authentication
- Email/password login with Zod validation
- Auth token stored in cookies
- Middleware-based route protection
- Role-based access (dispatcher role required)
- Demo credentials pre-filled

### Dashboard Overview
- 6 statistics cards:
  - Total tasks
  - Assigned tasks
  - In-progress tasks
  - Completed tasks
  - Online technicians
  - Completion rate
- Task distribution progress bars
- Technician online/offline status list
- Real-time updates via Supabase Realtime

### Task Management
- Full task list with sorting and filtering
- Filter by status: all / assigned / in_progress / completed
- Table columns: title, customer, address, priority, status, time, actions
- Color-coded priority and status indicators
- Create new task (form with React Hook Form + Zod)
- Assign task to technician (dropdown with available technicians)
- Real-time status updates (Supabase Realtime subscription)
- Push task to technician via WebSocket notification

### Technician Management
- Statistics: total, online, offline
- Table with technician details:
  - Name, email, phone
  - Online/offline indicator (green/grey dot)
  - Last known location
  - Join date
- Click technician → detail view with their tasks

### Map View
- Mapbox GL JS / react-map-gl integration
- Real-time technician positions on map
- Click marker → technician detail + their tasks
- Cluster markers for large numbers of technicians
- Geofence visualization (circles around task locations)

### Analytics
- Task completion rates
- Performance metrics per technician
- Historical data views

---

## 🔄 Offline-First Synchronization

### How It Works

```
ONLINE STATE:
  Pull Sync (Background)
  1. Fetch changes from server (delta sync)
  2. Update local SQLite
  3. Invalidate TanStack Query cache
  4. UI updates automatically

OFFLINE STATE:
  Local Changes
  1. User makes changes (create/update/delete)
  2. Changes saved to local SQLite
  3. Changes added to sync_queue
  4. UI updates optimistically
  5. Offline banner shown

TRANSITION OFFLINE → ONLINE:
  Push Sync
  1. Detect network status change
  2. Fetch sync_queue items
  3. Send to server
  4. Server validates & applies changes
  5. Handle conflicts (last write wins)
  6. Clear sync_queue
  7. Pull latest data from server
  8. Update local SQLite
  9. Invalidate TanStack Query cache
  10. UI updates with server data
```

### Conflict Resolution
- Every record has `version` (integer) and `updated_at` (timestamp)
- On push sync, server compares versions
- Default strategy: **last write wins**
- On conflict: server returns both versions; UI can show resolution dialog

---

## 🔐 Security Features

- **Row Level Security (RLS):** Database-level access control
  - Technicians see only their own tasks, reports, and location
  - Dispatchers see all data
  - Sync queue is private per user
- **Secure Auth:** JWT tokens with `expo-secure-store` on mobile, cookies on web
- **Type Safety:** TypeScript strict mode + Zod validation on both client and server
- **Protected Routes:** Middleware-based route protection on web, layout-based on mobile
- **Encrypted Storage:** Secure token storage on mobile device

---

## 🎯 Demo Credentials

| Role       | Email                  | Password |
|------------|------------------------|----------|
| Dispatcher | dispatcher1@demo.cz    | demo123  |
| Dispatcher | dispatcher2@demo.cz    | demo123  |
| Technician | technik1@demo.cz       | demo123  |
| Technician | technik2@demo.cz       | demo123  |
| Technician | technik3@demo.cz       | demo123  |
| Technician | technik4@demo.cz       | demo123  |
| Technician | technik5@demo.cz       | demo123  |

> **Note:** Auth users must be created in Supabase Auth with matching emails and passwords.
> See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for details.
