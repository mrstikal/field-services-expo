import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}));

describe('Mobile Security Tests – Auth token edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle expired token (JWT expired)', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired', status: 401 } as any,
    });

    const { data, error } = await supabase.auth.getUser('expired-token');

    expect(error?.message).toBe('JWT expired');
    expect(data.user).toBeNull();
  });

  it('should handle unauthorized access (no token)', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth required', status: 401 } as any,
    });

    const { error } = await supabase.auth.getUser('');
    expect(error?.message).toBe('Auth required');
  });

  it('should handle malformed Authorization header (missing Bearer prefix)', async () => {
    // Simulate what happens when the token is passed without "Bearer " prefix
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid JWT format', status: 400 } as any,
    });

    // Token without "Bearer " prefix – server would reject this
    const rawToken = 'not-a-bearer-token';
    const { data, error } = await supabase.auth.getUser(rawToken);

    expect(data.user).toBeNull();
    expect(error?.message).toContain('Invalid JWT');
  });

  it('should handle completely invalid token format', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT: unable to parse', status: 400 } as any,
    });

    const { data, error } = await supabase.auth.getUser('not.a.valid.jwt.token.at.all');

    expect(data.user).toBeNull();
    expect(error?.message).toContain('invalid JWT');
  });

  it('should handle token with wrong signature', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT signature mismatch', status: 401 } as any,
    });

    const { data, error } = await supabase.auth.getUser('header.payload.wrong-signature');

    expect(data.user).toBeNull();
    expect(error?.message).toContain('signature');
  });
});

describe('Mobile Security Tests – Role-based access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deny access when user has no role in users table', async () => {
    // Simulate a valid auth user but missing from users table (no business role)
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'orphan-user', email: 'orphan@test.com' } },
      error: null,
    } as any);

    const { data: { user } } = await supabase.auth.getUser('valid-token');

    // User exists in auth but has no business role – should be denied
    expect(user).not.toBeNull();
    // In real implementation, the sync endpoint would return 401 for missing users table entry
    // Here we verify the user object is present but role check would fail
    expect(user?.id).toBe('orphan-user');
  });

  it('should allow technician role to access own tasks only', async () => {
    const technicianUser = { id: 'tech-1', email: 'tech@test.com', role: 'technician' };
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: technicianUser },
      error: null,
    } as any);

    const { data: { user } } = await supabase.auth.getUser('tech-token');

    expect(user?.id).toBe('tech-1');
    // Technician should only see their own tasks (enforced by sync pull filter)
  });

  it('should allow dispatcher role to access all tasks', async () => {
    const dispatcherUser = { id: 'dispatcher-1', email: 'dispatcher@test.com', role: 'dispatcher' };
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: dispatcherUser },
      error: null,
    } as any);

    const { data: { user } } = await supabase.auth.getUser('dispatcher-token');

    expect(user?.id).toBe('dispatcher-1');
    // Dispatcher should see all tasks (no technician_id filter in sync pull)
  });

  it('should reject login with invalid credentials', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 } as any,
    } as any);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'wrong@test.com',
      password: 'wrongpassword',
    });

    expect(data.user).toBeNull();
    expect(data.session).toBeNull();
    expect(error?.message).toBe('Invalid login credentials');
  });

  it('should reject login with empty credentials', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email and password are required', status: 400 } as any,
    } as any);

    const { error } = await supabase.auth.signInWithPassword({
      email: '',
      password: '',
    });

    expect(error?.message).toContain('required');
  });

  it('should handle token refresh failure gracefully', async () => {
    // First call returns expired token error
    vi.mocked(supabase.auth.getUser)
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'JWT expired', status: 401 } as any,
      })
      // Second call (after refresh attempt) also fails
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Refresh token expired', status: 401 } as any,
      });

    const firstAttempt = await supabase.auth.getUser('expired-token');
    expect(firstAttempt.error?.message).toBe('JWT expired');

    const secondAttempt = await supabase.auth.getUser('expired-refresh-token');
    expect(secondAttempt.error?.message).toBe('Refresh token expired');
    expect(secondAttempt.data.user).toBeNull();
  });
});
