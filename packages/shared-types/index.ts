// Task types
export type TaskStatus = 'assigned' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'repair' | 'installation' | 'maintenance' | 'inspection';

export interface Task {
  id: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  due_date: string;
  customer_name: string;
  customer_phone: string;
  estimated_time: number;
  technician_id: string | null;
  created_at: string;
  updated_at: string;
}

// Technician types
export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'technician' | 'dispatcher';
  avatar_url: string | null;
  is_online: boolean;
  last_location: {
    latitude: number;
    longitude: number;
  } | null;
  created_at: string;
}

// Report types
export type ReportStatus = 'draft' | 'completed' | 'synced';

export interface Report {
  id: string;
  task_id: string;
  status: ReportStatus;
  photos: string[];
  form_data: Record<string, unknown>;
  signature: string | null;
  created_at: string;
  updated_at: string;
}

// Location types
export interface Location {
  id: string;
  technician_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

// Sync types
export interface SyncPayload {
  type: 'task' | 'report' | 'location';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: string;
}

// User types
export interface User {
  id: string;
  email: string;
  role: 'technician' | 'dispatcher';
  profile: {
    name: string;
    phone: string;
    avatar_url: string | null;
  };
}

// Parts/Inventory types
export interface Part {
  id: string;
  name: string;
  description: string;
  barcode: string;
  price: number;
  stock: number;
  category: string;
  created_at: string;
}