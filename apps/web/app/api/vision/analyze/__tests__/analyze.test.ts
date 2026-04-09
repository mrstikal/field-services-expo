import { POST } from '@/app/api/vision/analyze/route';
import { requireBearerUser } from '@/lib/server-supabase';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/server-supabase', () => ({
  requireBearerUser: vi.fn(),
}));

describe('Vision Analyze API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLOUD_API_KEY = 'server-vision-key';
    vi.mocked(requireBearerUser).mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
    });
  });

  const createRequest = (
    body: unknown,
    headers?: Record<string, string>
  ) =>
    ({
      headers: {
        get: (name: string) => headers?.[name.toLowerCase()] ?? null,
      },
      json: async () => body,
    }) as unknown as NextRequest;

  it('returns 401 when bearer token is missing', async () => {
    const response = await POST(
      createRequest({ action: 'detect', imageBase64: 'abc' })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect((data as { error: string }).error).toContain('Unauthorized');
    expect(requireBearerUser).not.toHaveBeenCalled();
  });

  it('returns 503 when server API key is missing', async () => {
    delete process.env.GOOGLE_CLOUD_API_KEY;

    const response = await POST(
      createRequest(
        { action: 'detect', imageBase64: 'abc' },
        { authorization: 'Bearer test-token' }
      )
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect((data as { error: string }).error).toContain('not configured');
  });

  it('proxies detect action and maps labels/objects', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          responses: [
            {
              labelAnnotations: [{ description: 'Wire', score: 0.95 }],
              localizedObjectAnnotations: [
                {
                  name: 'Circuit breaker',
                  score: 0.91,
                  boundingPoly: { vertices: [{ x: 1, y: 2 }, {}] },
                },
              ],
            },
          ],
        }),
    } as Response);

    const response = await POST(
      createRequest(
        { action: 'detect', imageBase64: 'abc' },
        { authorization: 'Bearer test-token' }
      )
    );
    const data = (await response.json()) as {
      labels: Array<{ text: string }>;
      objects: Array<{ name: string; boundingPoly: { vertices: any[] } }>;
    };

    expect(response.status).toBe(200);
    expect(requireBearerUser).toHaveBeenCalledWith('test-token');
    expect(data.labels[0].text).toBe('Wire');
    expect(data.objects[0].name).toBe('Circuit breaker');
    expect(data.objects[0].boundingPoly.vertices[1]).toEqual({ x: 0, y: 0 });
  });
});
