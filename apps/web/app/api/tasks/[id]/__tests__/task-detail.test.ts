import { DELETE, GET, PATCH, PUT } from '@/app/api/tasks/[id]/route';
import { sendExpoPushNotification } from '@/lib/expo-push';
import { getAppUserProfile, isDispatcher } from '@/lib/server-auth';
import { requireRequestUser } from '@/lib/server-supabase';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server-supabase', () => ({
  requireRequestUser: vi.fn(),
}));

vi.mock('@/lib/server-auth', () => ({
  getAppUserProfile: vi.fn(),
  isDispatcher: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  sendExpoPushNotification: vi.fn(),
}));

vi.mock('@/lib/api-errors', () => ({
  logApiError: vi.fn(),
}));

type TaskRecord = {
  id: string;
  title?: string;
  technician_id?: string | null;
  deleted_at?: string | null;
  version?: number;
};

const mockedRequireRequestUser = vi.mocked(requireRequestUser);
const mockedGetAppUserProfile = vi.mocked(getAppUserProfile);
const mockedIsDispatcher = vi.mocked(isDispatcher);
const mockedSendExpoPushNotification = vi.mocked(sendExpoPushNotification);

function createRequest(body?: unknown) {
  return {
    headers: { get: () => null },
    json: async () => body ?? {},
  } as unknown as NextRequest;
}

function createSupabase(tasks: Record<string, TaskRecord>, technicianPushToken?: string) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'tasks') {
        const taskScope: {
          id: string | null;
          includeDeletedFilter: boolean;
          payload: Record<string, unknown> | null;
        } = {
          id: null,
          includeDeletedFilter: false,
          payload: null,
        };
        const query = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((column: string, value: string) => {
            if (column === 'id') {
              taskScope.id = value;
            }
            return query;
          }),
          is: vi.fn((column: string) => {
            if (column === 'deleted_at') {
              taskScope.includeDeletedFilter = true;
            }
            return query;
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            taskScope.payload = payload;
            return query;
          }),
          maybeSingle: vi.fn(async () => {
            const task = taskScope.id ? tasks[taskScope.id] : undefined;
            if (!task) {
              return { data: null, error: null };
            }
            if (taskScope.includeDeletedFilter && task.deleted_at) {
              return { data: null, error: null };
            }
            return { data: task, error: null };
          }),
          single: vi.fn(async () => {
            const task = taskScope.id ? tasks[taskScope.id] : undefined;
            if (!task || !taskScope.payload) {
              return { data: null, error: null };
            }

            const updated: TaskRecord = {
              ...task,
              ...taskScope.payload,
            };
            tasks[task.id] = updated;
            return { data: updated, error: null };
          }),
        };

        return query;
      }

      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: technicianPushToken
              ? { expo_push_token: technicianPushToken, name: 'Tech One' }
              : null,
            error: null,
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('Task Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAppUserProfile.mockResolvedValue({ role: 'dispatcher' } as never);
    mockedIsDispatcher.mockReturnValue(true);
  });

  it('returns 200 for GET when task exists', async () => {
    const supabase = createSupabase({
      'task-1': { id: 'task-1', title: 'Found Task', version: 1, deleted_at: null },
    });
    mockedRequireRequestUser.mockResolvedValue({
      supabase,
      user: { id: 'dispatcher-1' },
      error: null,
    } as never);

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: 'task-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('task-1');
    expect(data.title).toBe('Found Task');
  });

  it('returns 401 for GET when user is missing', async () => {
    mockedRequireRequestUser.mockResolvedValue({
      supabase: createSupabase({}),
      user: null,
      error: new Error('Unauthorized'),
    } as never);

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: 'task-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 for GET when task is not found', async () => {
    mockedRequireRequestUser.mockResolvedValue({
      supabase: createSupabase({}),
      user: { id: 'dispatcher-1' },
      error: null,
    } as never);

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: 'missing-task' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Task not found.');
  });

  it('returns 200 for PUT and sends push when technician changes', async () => {
    const tasks = {
      'task-1': {
        id: 'task-1',
        title: 'Task 1',
        technician_id: null,
        version: 1,
        deleted_at: null,
      },
    };
    const supabase = createSupabase(tasks, 'ExponentPushToken[test-token]');
    mockedRequireRequestUser.mockResolvedValue({
      supabase,
      user: { id: 'dispatcher-1' },
      error: null,
    } as never);

    const response = await PUT(
      createRequest({
        title: 'Task 1',
        technician_id: '11111111-1111-4111-8111-111111111111',
        status: 'assigned',
      }),
      { params: Promise.resolve({ id: 'task-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.technician_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(mockedSendExpoPushNotification).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for PUT when user is not dispatcher', async () => {
    mockedIsDispatcher.mockReturnValue(false);
    mockedRequireRequestUser.mockResolvedValue({
      supabase: createSupabase({}),
      user: { id: 'tech-1' },
      error: null,
    } as never);

    const response = await PUT(createRequest({ title: 'Task 1' }), {
      params: Promise.resolve({ id: 'task-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 200 for PATCH and delegates to PUT flow', async () => {
    const tasks = {
      'task-1': {
        id: 'task-1',
        title: 'Original',
        technician_id: null,
        version: 1,
        deleted_at: null,
      },
    };
    mockedRequireRequestUser.mockResolvedValue({
      supabase: createSupabase(tasks),
      user: { id: 'dispatcher-1' },
      error: null,
    } as never);

    const response = await PATCH(
      createRequest({ title: 'Patched title' }),
      { params: Promise.resolve({ id: 'task-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe('Patched title');
  });

  it('returns 204 for DELETE when task exists', async () => {
    const tasks = {
      'task-1': { id: 'task-1', title: 'Task 1', version: 1, deleted_at: null },
    };
    mockedRequireRequestUser.mockResolvedValue({
      supabase: createSupabase(tasks),
      user: { id: 'dispatcher-1' },
      error: null,
    } as never);

    const response = await DELETE(createRequest(), {
      params: Promise.resolve({ id: 'task-1' }),
    });

    expect(response.status).toBe(204);
  });
});
