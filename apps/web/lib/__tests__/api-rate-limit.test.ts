import { checkRateLimit, resetRateLimitStore } from '@/lib/api-rate-limit';

describe('api-rate-limit', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('allows requests under the limit', () => {
    const first = checkRateLimit('user-1', {
      maxRequests: 2,
      windowMs: 60_000,
      now: 1_000,
    });
    const second = checkRateLimit('user-1', {
      maxRequests: 2,
      windowMs: 60_000,
      now: 2_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it('blocks requests over the limit and returns retry-after', () => {
    checkRateLimit('user-1', { maxRequests: 1, windowMs: 10_000, now: 1_000 });
    const blocked = checkRateLimit('user-1', {
      maxRequests: 1,
      windowMs: 10_000,
      now: 2_000,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the time window', () => {
    checkRateLimit('user-1', { maxRequests: 1, windowMs: 10_000, now: 1_000 });
    const afterWindow = checkRateLimit('user-1', {
      maxRequests: 1,
      windowMs: 10_000,
      now: 12_000,
    });

    expect(afterWindow.allowed).toBe(true);
  });
});
