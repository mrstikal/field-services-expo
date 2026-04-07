import '@testing-library/jest-dom';
import { vi } from 'vitest';

export const mockSupabaseAuth = {
  getUser: vi.fn(),
};

export const mockSupabaseFrom = {
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

export const mockSupabaseChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(() => ({
    unsubscribe: vi.fn(),
  })),
};

export const mockSupabaseClient = {
  auth: mockSupabaseAuth,
  from: vi.fn(() => mockSupabaseFrom),
  channel: vi.fn(() => mockSupabaseChannel),
  removeChannel: vi.fn(),
};

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Mock Supabase lib (singleton)
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

// Mock Drizzle
vi.mock('@db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  },
  connect: vi.fn().mockResolvedValue(undefined),
}));

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
}));

// Mock process.env
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
