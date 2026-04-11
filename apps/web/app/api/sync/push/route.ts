import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  businessRoleSchema,
  type BusinessRole,
  conversationRecordSchema,
  locationRecordSchema,
  messageReadRecordSchema,
  messageRecordSchema,
  reportRecordSchema,
  taskPrioritySchema,
  taskStatusSchema,
  taskCategorySchema,
  syncPushRequestSchema,
  taskRecordSchema,
} from '@field-service/shared-types';
import { z } from 'zod';
import { logApiError } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { requireBearerUser } from '@/lib/server-supabase';
import { canMutateReport, canMutateTask } from '@/lib/sync-authorization';

function loadEnvFilesIfNeeded() {
  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY
  ) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as typeof import('dotenv');
  const visited = new Set<string>();
  let currentDir = process.cwd();

  for (let i = 0; i < 6; i++) {
    const candidates = [
      path.join(currentDir, 'env.local'),
      path.join(currentDir, '.env.local'),
    ];

    for (const candidate of candidates) {
      if (!visited.has(candidate) && existsSync(candidate)) {
        visited.add(candidate);
        dotenv.config({ path: candidate, override: false });
      }
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }
}

function createServiceRoleClient() {
  loadEnvFilesIfNeeded();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required Supabase service role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

const taskUpdatePayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    address: z.string().trim().min(1).max(500),
    latitude: z.number().finite().nullable(),
    longitude: z.number().finite().nullable(),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    category: taskCategorySchema,
    due_date: z.string().trim().min(1),
    customer_name: z.string().trim().min(1).max(200),
    customer_phone: z.string().trim().min(1).max(50),
    estimated_time: z.number().int().min(0).max(24 * 60),
    technician_id: z.string().uuid().nullable(),
    updated_at: z.string().trim().min(1),
    deleted_at: z.string().trim().min(1).nullable(),
    version: z.number().int().min(1),
  })
  .partial();

function parseTaskPayload(
  action: 'create' | 'update' | 'delete',
  data: Record<string, unknown>
) {
  if (action === 'delete') {
    return taskRecordSchema
      .pick({ id: true, deleted_at: true, updated_at: true, version: true })
      .safeParse(data);
  }
  if (action === 'update') {
    return taskUpdatePayloadSchema.safeParse(data);
  }
  return taskRecordSchema.safeParse(data);
}

function parseReportPayload(
  action: 'create' | 'update' | 'delete',
  data: Record<string, unknown>
) {
  if (action === 'delete') {
    return reportRecordSchema
      .pick({ id: true, deleted_at: true, updated_at: true, version: true })
      .safeParse(data);
  }
  return reportRecordSchema.safeParse(data);
}

function parseLocationPayload(data: Record<string, unknown>) {
  return locationRecordSchema.safeParse(data);
}

function parseConversationPayload(data: Record<string, unknown>) {
  return conversationRecordSchema.safeParse(data);
}

function parseMessagePayload(data: Record<string, unknown>) {
  return messageRecordSchema.safeParse(data);
}

function parseMessageReadPayload(data: Record<string, unknown>) {
  return messageReadRecordSchema.safeParse(data);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter(value => typeof value === 'string' && value.trim().length > 0)
      .map(value => String(value));

    if (parts.length > 0) {
      return parts.join(' | ');
    }
  }

  return 'Unknown sync error';
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = await requireBearerUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`sync-push:${user.id}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many sync push requests.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const parsedBody = syncPushRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid sync push payload.',
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (userProfileError) {
      throw userProfileError;
    }
    const parsedRole = businessRoleSchema.safeParse(
      (userProfile as { role?: string } | null)?.role
    );
    const userRole: BusinessRole = parsedRole.success
      ? parsedRole.data
      : 'technician';
    const admin = createServiceRoleClient();

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      conflicts: [] as string[],
      itemResults: [] as Array<{
        id: string;
        status: 'success' | 'failed' | 'conflict';
        error?: string;
        record?: Record<string, unknown>;
        serverRecord?: Record<string, unknown>;
      }>,
    };
    const conversationIdMap = new Map<string, string>();

    for (const change of parsedBody.data.changes) {
      try {
        switch (change.type) {
          case 'task': {
            const parsedTask = parseTaskPayload(change.action, change.data);
            if (!parsedTask.success) {
              const issuePath = parsedTask.error.issues[0]?.path?.join('.') || '';
              const issueMessage = parsedTask.error.issues[0]?.message || '';
              const details = [issuePath, issueMessage].filter(Boolean).join(': ');
              throw new Error(
                details
                  ? `Invalid task payload (${details}).`
                  : 'Invalid task payload.'
              );
            }

            const { data: existingTask, error: existingTaskError } =
              await supabase
                .from('tasks')
                .select('*')
                .eq('id', change.entityId)
                .maybeSingle();

            if (existingTaskError) throw existingTaskError;
            if (existingTask && existingTask.version > (change.version ?? 0)) {
              results.conflicts.push(`task:${change.entityId}`);
              results.itemResults.push({
                id: change.id,
                status: 'conflict',
                error: 'Task version conflict.',
                serverRecord: existingTask,
              });
              break;
            }
            if (
              !canMutateTask(userRole, user.id, {
                existingTechnicianId: existingTask
                  ? ((existingTask as { technician_id?: string | null })
                      .technician_id ?? null)
                  : undefined,
                incomingTechnicianId:
                  'technician_id' in parsedTask.data
                    ? (parsedTask.data.technician_id as string | null)
                    : undefined,
              })
            ) {
              throw new Error('Forbidden: insufficient permissions for task.');
            }

            let taskRecord: Record<string, unknown> | null = null;
            if (change.action === 'delete') {
              const { data, error } = await supabase
                .from('tasks')
                .update({
                  deleted_at: parsedTask.data.deleted_at,
                  updated_at: parsedTask.data.updated_at,
                  version: parsedTask.data.version,
                })
                .eq('id', change.entityId)
                .select('*')
                .single();
              if (error) throw error;
              taskRecord = data;
            } else if (change.action === 'update') {
              if (!existingTask) {
                throw new Error('Task not found for update.');
              }

              const taskUpdateData = {
                ...(parsedTask.data as Record<string, unknown>),
              };
              delete taskUpdateData.id;
              if (Object.keys(taskUpdateData).length === 0) {
                throw new Error('Invalid task payload (no update fields).');
              }

              const { data, error } = await supabase
                .from('tasks')
                .update(taskUpdateData)
                .eq('id', change.entityId)
                .select('*')
                .single();
              if (error) throw error;
              taskRecord = data;
            } else {
              const { data, error } = await supabase
                .from('tasks')
                .upsert([parsedTask.data], { onConflict: 'id' })
                .select('*')
                .single();
              if (error) throw error;
              taskRecord = data;
            }

            results.success++;
            results.itemResults.push({
              id: change.id,
              status: 'success',
              record: taskRecord ?? undefined,
            });
            break;
          }

          case 'report': {
            const parsedReport = parseReportPayload(change.action, change.data);
            if (!parsedReport.success) {
              throw new Error('Invalid report payload.');
            }

            const { data: existingReport, error: existingReportError } =
              await supabase
                .from('reports')
                .select('*')
                .eq('id', change.entityId)
                .maybeSingle();

            if (existingReportError) throw existingReportError;
            if (
              existingReport &&
              existingReport.version > (change.version ?? 0)
            ) {
              results.conflicts.push(`report:${change.entityId}`);
              results.itemResults.push({
                id: change.id,
                status: 'conflict',
                error: 'Report version conflict.',
                serverRecord: existingReport,
              });
              break;
            }

            const reportTaskId =
              change.action === 'delete'
                ? ((existingReport as { task_id?: string | null } | null)
                    ?.task_id ?? null)
                : ('task_id' in parsedReport.data
                    ? parsedReport.data.task_id
                    : null);

            if (userRole === 'technician') {
              if (!reportTaskId) {
                throw new Error(
                  'Forbidden: report is not linked to an accessible task.'
                );
              }

              const { data: taskOwnership, error: taskOwnershipError } =
                await supabase
                  .from('tasks')
                  .select('technician_id')
                  .eq('id', reportTaskId)
                  .maybeSingle();

              if (taskOwnershipError) throw taskOwnershipError;
              if (
                !canMutateReport(
                  userRole,
                  user.id,
                  (
                    taskOwnership as {
                      technician_id?: string | null;
                    } | null
                  )?.technician_id
                )
              ) {
                throw new Error(
                  'Forbidden: insufficient permissions for report.'
                );
              }
            }

            let reportRecord: Record<string, unknown> | null = null;
            if (change.action === 'delete') {
              const { data, error } = await supabase
                .from('reports')
                .update({
                  deleted_at: parsedReport.data.deleted_at,
                  updated_at: parsedReport.data.updated_at,
                  version: parsedReport.data.version,
                })
                .eq('id', change.entityId)
                .select('*')
                .single();
              if (error) throw error;
              reportRecord = data;
            } else {
              const { data, error } = await supabase
                .from('reports')
                .upsert([parsedReport.data], { onConflict: 'id' })
                .select('*')
                .single();
              if (error) throw error;
              reportRecord = data;
            }

            results.success++;
            results.itemResults.push({
              id: change.id,
              status: 'success',
              record: reportRecord ?? undefined,
            });
            break;
          }

          case 'location': {
            const parsedLocation = parseLocationPayload(change.data);
            if (!parsedLocation.success) {
              throw new Error('Invalid location payload.');
            }
            if (
              userRole === 'technician' &&
              parsedLocation.data.technician_id !== user.id
            ) {
              throw new Error(
                'Forbidden: insufficient permissions for location.'
              );
            }

            const { data, error } = await supabase
              .from('locations')
              .upsert([parsedLocation.data], { onConflict: 'id' })
              .select('*')
              .single();
            if (error) throw error;

            const { error: presenceError } = await supabase
              .from('users')
              .update({
                is_online: true,
                last_location_lat: parsedLocation.data.latitude,
                last_location_lng: parsedLocation.data.longitude,
                updated_at: new Date().toISOString(),
              })
              .eq('id', parsedLocation.data.technician_id);
            if (presenceError) throw presenceError;

            results.success++;
            results.itemResults.push({
              id: change.id,
              status: 'success',
              record: data,
            });
            break;
          }

          case 'conversation': {
            const parsedConversation = parseConversationPayload(change.data);
            if (!parsedConversation.success) {
              throw new Error('Invalid conversation payload.');
            }

            const conversation = parsedConversation.data;
            if (
              conversation.user1_id !== user.id &&
              conversation.user2_id !== user.id
            ) {
              throw new Error(
                'Forbidden: conversation must include the authenticated user.'
              );
            }

            const { data: existingPreferred, error: existingPreferredError } =
              await admin
                .from('conversations')
                .select('*')
                .eq('user1_id', conversation.user1_id)
                .eq('user2_id', conversation.user2_id)
                .maybeSingle();
            if (existingPreferredError) throw existingPreferredError;

            const { data: existingReversed, error: existingReversedError } =
              await admin
                .from('conversations')
                .select('*')
                .eq('user1_id', conversation.user2_id)
                .eq('user2_id', conversation.user1_id)
                .maybeSingle();
            if (existingReversedError) throw existingReversedError;

            const existingConversation =
              existingPreferred ?? existingReversed ?? null;

            if (existingConversation) {
              conversationIdMap.set(conversation.id, existingConversation.id);
              results.success++;
              results.itemResults.push({
                id: change.id,
                status: 'success',
                record: existingConversation,
              });
              break;
            }

            const { data, error } = await admin
              .from('conversations')
              .insert([conversation])
              .select('*')
              .single();
            if (error) throw error;

            conversationIdMap.set(conversation.id, data.id);

            results.success++;
            results.itemResults.push({
              id: change.id,
              status: 'success',
              record: data,
            });
            break;
          }

          case 'message': {
            const parsedMessage = parseMessagePayload(change.data);
            if (!parsedMessage.success) {
              throw new Error('Invalid message payload.');
            }

            const originalMessage = parsedMessage.data;
            const resolvedConversationId =
              conversationIdMap.get(originalMessage.conversation_id) ??
              originalMessage.conversation_id;
            const message = {
              ...originalMessage,
              conversation_id: resolvedConversationId,
            };
            const { data: conversation, error: conversationError } =
              await admin
                .from('conversations')
                .select('id, user1_id, user2_id')
                .eq('id', message.conversation_id)
                .maybeSingle();
            if (conversationError) throw conversationError;
            if (
              !conversation ||
              (conversation.user1_id !== user.id &&
                conversation.user2_id !== user.id)
            ) {
              throw new Error(
                'Forbidden: message is not linked to an accessible conversation.'
              );
            }

            let messageRecord: Record<string, unknown> | null = null;
            if (change.action === 'delete') {
              const { data, error } = await admin
                .from('messages')
                .update({
                  content: message.content,
                  sent_at: message.sent_at,
                  edited_at: message.edited_at ?? null,
                  deleted_at: message.deleted_at ?? new Date().toISOString(),
                })
                .eq('id', change.entityId)
                .select('*')
                .single();
              if (error) throw error;
              messageRecord = data;
            } else if (change.action === 'update') {
              const { data, error } = await admin
                .from('messages')
                .update({
                  content: message.content,
                  sent_at: message.sent_at,
                  edited_at: message.edited_at ?? null,
                  deleted_at: message.deleted_at ?? null,
                })
                .eq('id', change.entityId)
                .select('*')
                .single();
              if (error) throw error;
              messageRecord = data;
            } else {
              const { data, error } = await admin
                .from('messages')
                .upsert([message], { onConflict: 'id' })
                .select('*')
                .single();
              if (error) throw error;
              messageRecord = data;
            }

            results.success++;
            results.itemResults.push({
              id: change.id,
              status: 'success',
              record: messageRecord ?? undefined,
            });
            break;
          }

          case 'message_read': {
            const parsedMessageRead = parseMessageReadPayload(change.data);
            if (!parsedMessageRead.success) {
              throw new Error('Invalid message read payload.');
            }

            const messageRead = parsedMessageRead.data;
            if (messageRead.user_id !== user.id) {
              throw new Error(
                'Forbidden: message read must belong to the authenticated user.'
              );
            }

            const { data: message, error: messageError } = await admin
              .from('messages')
              .select('id, conversation_id')
              .eq('id', messageRead.message_id)
              .maybeSingle();
            if (messageError) throw messageError;
            if (!message) {
              throw new Error('Message not found for read receipt.');
            }

            const { data: conversation, error: conversationError } =
              await admin
                .from('conversations')
                .select('id, user1_id, user2_id')
                .eq('id', message.conversation_id)
                .maybeSingle();
            if (conversationError) throw conversationError;
            if (
              !conversation ||
              (conversation.user1_id !== user.id &&
                conversation.user2_id !== user.id)
            ) {
              throw new Error(
                'Forbidden: message read is not linked to an accessible conversation.'
              );
            }

            const { data, error } = await admin
              .from('message_reads')
              .upsert([messageRead], { onConflict: 'message_id,user_id' })
              .select('*')
              .single();
            if (error) throw error;

            results.success++;
            results.itemResults.push({
              id: change.id,
              status: 'success',
              record: data,
            });
            break;
          }
        }
      } catch (error) {
        const message = getErrorMessage(error);
        results.failed++;
        results.errors.push(message);
        results.itemResults.push({
          id: change.id,
          status: 'failed',
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    logApiError('sync:push', error);
    return NextResponse.json(
      { error: 'Unable to push sync changes.' },
      { status: 500 }
    );
  }
}
