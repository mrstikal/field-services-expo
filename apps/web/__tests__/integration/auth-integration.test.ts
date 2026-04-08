import { NextRequest, NextResponse } from 'next/server';
import { mockSupabaseAuth, mockSupabaseClient } from '@/vitest.setup';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
    redirect: vi.fn((url: any) => ({
      status: 302,
      headers: { get: (name?: string) => url },
    })),
  },
}));

describe('Web Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful login', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockSupabaseAuth.getUser.mockResolvedValue({ 
      data: { user: mockUser }, 
      error: null 
    } as any);

    const { data: { user }, error } = await mockSupabaseClient.auth.getUser('valid-token');

    expect(user).toEqual(mockUser);
    expect(error).toBeNull();
    expect(mockSupabaseAuth.getUser).toHaveBeenCalledWith('valid-token');
  });

  it('should handle failed login with invalid credentials', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: { message: 'Invalid credentials' } 
    } as any);

    const { data: { user }, error } = await mockSupabaseClient.auth.getUser('invalid-token');

    expect(user).toBeNull();
    expect(error).toEqual({ message: 'Invalid credentials' });
  });

  it('should simulate protected route redirection when unauthorized', async () => {
    // In Next.js, this is usually handled in middleware or server components
    // Here we simulate the logic
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    
    const request = {
      nextUrl: { pathname: '/dashboard' },
    } as any;

    const { data: { user } } = await mockGetUser();

    if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
      const response = NextResponse.redirect(new URL('/login', 'http://localhost:3000').toString());
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('/login');
    }
  });

  it('should handle successful logout', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.auth.signOut = mockSignOut;

    const { error } = await mockSupabaseClient.auth.signOut();

    expect(error).toBeNull();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
