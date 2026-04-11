import { z } from 'zod';

export const businessRoleSchema = z.enum(['technician', 'dispatcher']);
export type BusinessRole = z.infer<typeof businessRoleSchema>;

export const taskStatusSchema = z.enum([
  'assigned',
  'in_progress',
  'completed',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const taskCategorySchema = z.enum([
  'repair',
  'installation',
  'maintenance',
  'inspection',
]);
export type TaskCategory = z.infer<typeof taskCategorySchema>;

export const reportStatusSchema = z.enum(['draft', 'completed', 'synced']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const syncEntityTypeSchema = z.enum([
  'task',
  'report',
  'location',
  'conversation',
  'message',
  'message_read',
]);
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;

export const syncActionSchema = z.enum(['create', 'update', 'delete']);
export type SyncAction = z.infer<typeof syncActionSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });
const nullableIsoDateTimeSchema = isoDateTimeSchema.nullable();
const coordinatesSchema = z.number().finite();

export const taskRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  address: z.string().trim().min(1).max(500),
  latitude: coordinatesSchema.nullable(),
  longitude: coordinatesSchema.nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  category: taskCategorySchema,
  due_date: isoDateTimeSchema,
  customer_name: z.string().trim().min(1).max(200),
  customer_phone: z.string().trim().min(1).max(50),
  estimated_time: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  technician_id: z.string().uuid().nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  version: z.number().int().min(1),
  deleted_at: nullableIsoDateTimeSchema,
});
export type Task = Omit<z.infer<typeof taskRecordSchema>, 'deleted_at'> & {
  deleted_at?: string | null;
  synced?: number;
};

export const localTaskSchema = taskRecordSchema.extend({
  synced: z.number().int().min(0).max(1),
});
export type LocalTask = z.infer<typeof localTaskSchema>;

export const taskCreateInputSchema = taskRecordSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    version: true,
    deleted_at: true,
  })
  .extend({
    status: taskStatusSchema.default('assigned'),
    priority: taskPrioritySchema.default('medium'),
  });
export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>;

export const taskUpdateInputSchema = taskCreateInputSchema
  .partial()
  .refine(
    (value: Record<string, unknown>) => Object.keys(value).length > 0,
    'At least one field must be provided.'
  );
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;

export const reportRecordSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  status: reportStatusSchema,
  photos: z.array(z.string().trim().min(1)),
  form_data: z.record(z.string(), z.unknown()),
  signature: z.string().nullable(),
  pdf_url: z.string().nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  version: z.number().int().min(1),
  deleted_at: nullableIsoDateTimeSchema,
});
export type Report = Omit<
  z.infer<typeof reportRecordSchema>,
  'deleted_at' | 'pdf_url'
> & { deleted_at?: string | null; pdf_url?: string | null; synced?: number };

export const localReportSchema = reportRecordSchema.extend({
  synced: z.number().int().min(0).max(1),
});
export type LocalReport = z.infer<typeof localReportSchema>;

export const locationRecordSchema = z.object({
  id: z.string().uuid(),
  technician_id: z.string().uuid(),
  latitude: coordinatesSchema,
  longitude: coordinatesSchema,
  accuracy: z.number().finite().min(0),
  timestamp: isoDateTimeSchema,
  created_at: isoDateTimeSchema.optional(),
});
export type Location = z.infer<typeof locationRecordSchema>;

export const conversationRecordSchema = z.object({
  id: z.string().uuid(),
  user1_id: z.string().uuid(),
  user2_id: z.string().uuid(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type ConversationRecord = z.infer<typeof conversationRecordSchema>;

export const messageRecordSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string().trim().min(1).max(1000),
  sent_at: isoDateTimeSchema,
  edited_at: nullableIsoDateTimeSchema.optional(),
  deleted_at: nullableIsoDateTimeSchema.optional(),
});
export type MessageRecord = z.infer<typeof messageRecordSchema>;

export const messageReadRecordSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  user_id: z.string().uuid(),
  read_at: isoDateTimeSchema,
});
export type MessageReadRecord = z.infer<typeof messageReadRecordSchema>;

export const syncChangeSchema = z.object({
  id: z.string().uuid(),
  type: syncEntityTypeSchema,
  action: syncActionSchema,
  entityId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
  version: z.number().int().min(1).nullable().optional(),
});
export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncPullRequestSchema = z.object({
  lastSyncTimestamp: isoDateTimeSchema,
});
export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>;

export const syncPushRequestSchema = z.object({
  changes: z.array(syncChangeSchema).min(1),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export interface SyncConflict {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  resolution: 'server_wins' | 'local_wins';
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  created_at: string;
  resolved_at: string;
}

export interface SyncPayload {
  type: SyncEntityType;
  action: SyncAction;
  data: unknown;
  timestamp: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: BusinessRole;
  avatar_url: string | null;
  is_online: boolean;
  last_location: {
    latitude: number;
    longitude: number;
  } | null;
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  role: BusinessRole;
  profile: {
    name: string;
    phone: string;
    avatar_url: string | null;
  };
}

export interface Part {
  id: string;
  name: string;
  description: string | null;
  barcode: string;
  price: number;
  stock: number;
  category: string;
  created_at: string;
  updated_at?: string;
}

export type FormFieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'photo'
  | 'signature';

export interface FormFieldOption {
  label: string;
  value: string | number;
}

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  options?: FormFieldOption[];
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  conditional?: {
    fieldId: string;
    value: string | number | boolean;
  };
  defaultValue?: string | number | boolean;
}

export interface FormTemplate {
  id: string;
  categoryId: TaskCategory;
  name: string;
  fields: FormField[];
  version: number;
  created_at: string;
}

export interface ReportFormData {
  [key: string]: string | number | boolean | string[];
}

export interface TaskListResponse {
  data: Task[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface ConversationWithDetails extends Conversation {
  other_user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: BusinessRole;
  };
  last_message?: Message;
  unread_count: number;
}

export interface MessageWithSender extends Message {
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  is_read: boolean;
}

export const CreateConversationInputSchema = z.object({
  user1_id: z.string().trim().min(1),
  user2_id: z.string().trim().min(1),
});
export type CreateConversationInput = z.infer<
  typeof CreateConversationInputSchema
>;

export const SendMessageInputSchema = z.object({
  conversation_id: z.string().trim().min(1),
  content: z.string().trim().min(1).max(1000),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;
