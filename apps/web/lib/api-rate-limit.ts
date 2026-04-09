type RateLimitEntry = {
  windowStart: number;
  count: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  options?: {
    maxRequests?: number;
    windowMs?: number;
    now?: number;
  }
): RateLimitResult {
  const maxRequests = options?.maxRequests ?? 60;
  const windowMs = options?.windowMs ?? 60_000;
  const now = options?.now ?? Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= maxRequests) {
    const retryAfterMs = Math.max(0, windowMs - (now - existing.windowStart));
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimitStore() {
  rateLimitStore.clear();
}
