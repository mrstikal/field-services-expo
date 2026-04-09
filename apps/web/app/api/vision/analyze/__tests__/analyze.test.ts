import { POST } from '@/app/api/vision/analyze/route';
import type { NextRequest } from 'next/server';

describe('Vision Analyze API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLOUD_API_KEY = 'server-vision-key';
  });

  const createRequest = (body: unknown) =>
    ({
      json: async () => body,
    }) as unknown as NextRequest;

  it('returns 503 when server API key is missing', async () => {
    delete process.env.GOOGLE_CLOUD_API_KEY;

    const response = await POST(
      createRequest({ action: 'detect', imageBase64: 'abc' })
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
      createRequest({ action: 'detect', imageBase64: 'abc' })
    );
    const data = (await response.json()) as {
      labels: Array<{ text: string }>;
      objects: Array<{ name: string; boundingPoly: { vertices: any[] } }>;
    };

    expect(response.status).toBe(200);
    expect(data.labels[0].text).toBe('Wire');
    expect(data.objects[0].name).toBe('Circuit breaker');
    expect(data.objects[0].boundingPoly.vertices[1]).toEqual({ x: 0, y: 0 });
  });
});

