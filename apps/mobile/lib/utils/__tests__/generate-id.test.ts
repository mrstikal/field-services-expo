import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateId } from '../generate-id';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => 'uuid-from-crypto');
    vi.stubGlobal('crypto', {
      randomUUID,
      getRandomValues: vi.fn(),
    });

    expect(generateId()).toBe('uuid-from-crypto');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to a v4 uuid when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    const id = generateId();

    expect(id).toMatch(UUID_V4_PATTERN);
  });
});
