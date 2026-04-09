import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '../updates+api';

const originalEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

describe('mobile api updates route', () => {
  afterEach(() => {
    if (typeof originalEnv === 'undefined') {
      delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    } else {
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID = originalEnv;
    }
  });

  it('returns disabled OTA status when EAS project id is missing', async () => {
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

    const response = GET(new Request('http://localhost/api/updates'));
    const payload = (await response.json()) as {
      env: string;
      hasEasProjectId: boolean;
      updatesUrlConfigured: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.hasEasProjectId).toBe(false);
    expect(payload.updatesUrlConfigured).toBe(false);
  });

  it('returns enabled OTA status when EAS project id is configured', async () => {
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID =
      '11111111-1111-4111-8111-111111111111';

    const response = GET(new Request('http://localhost/api/updates'));
    const payload = (await response.json()) as {
      env: string;
      hasEasProjectId: boolean;
      updatesUrlConfigured: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.hasEasProjectId).toBe(true);
    expect(payload.updatesUrlConfigured).toBe(true);
  });

  it('treats placeholder project id as not configured for OTA updates', async () => {
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'YOUR_EAS_PROJECT_ID';

    const response = GET(new Request('http://localhost/api/updates'));
    const payload = (await response.json()) as {
      env: string;
      hasEasProjectId: boolean;
      updatesUrlConfigured: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.hasEasProjectId).toBe(true);
    expect(payload.updatesUrlConfigured).toBe(false);
  });
});
