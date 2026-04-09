import { describe, expect, it } from 'vitest';
import { GET } from '../health+api';

describe('mobile api health route', () => {
  it('returns health payload with default environment', async () => {
    const response = GET(new Request('http://localhost/api/health'));
    const payload = (await response.json()) as {
      status: string;
      service: string;
      env: string;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: 'ok',
      service: 'field-service-mobile-api',
      env: 'development',
    });
  });
});
