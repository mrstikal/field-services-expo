import { NextRequest, NextResponse } from 'next/server';
import {
  locationRecordSchema,
  reportRecordSchema,
  syncPushRequestSchema,
  taskRecordSchema,
} from '@field-service/shared-types';
import { logApiError } from '@/lib/api-errors';
import { requireBearerUser } from '@/lib/server-supabase';

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

function parseTaskPayload(
  action: 'create' | 'update' | 'delete',
  data: Record<string, unknown>
) {
  if (action === 'delete') {
    return taskRecordSchema
      .pick({ id: true, deleted_at: true, updated_at: true, version: true })
      .safeParse(data);
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

    for (const change of parsedBody.data.changes) {
      try {
        switch (change.type) {
          case 'task': {
            const parsedTask = parseTaskPayload(change.action, change.data);
            if (!parsedTask.success) {
              throw new Error('Invalid task payload.');
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

            const { data, error } = await supabase
              .from('locations')
              .upsert([parsedLocation.data], { onConflict: 'id' })
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
        const message =
          error instanceof Error ? error.message : 'Unknown sync error';
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
