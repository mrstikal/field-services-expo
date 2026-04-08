import { describe, expect, it, vi } from 'vitest';

describe('whatwg-fetch shim', () => {
  it('preserves the existing global fetch implementation', async () => {
    const originalFetch = globalThis.fetch;
    const sentinelFetch = vi.fn();

    globalThis.fetch = sentinelFetch as typeof globalThis.fetch;
    vi.resetModules();

    const shimModule = await import('@/shims/whatwg-fetch/index.js');

    expect(globalThis.fetch).toBe(sentinelFetch);
    expect(shimModule.default.fetch).toBeDefined();
    expect(typeof shimModule.default.fetch).toBe('function');

    globalThis.fetch = originalFetch;
  });
});
