import { describe, expect, it } from 'vitest';
import {
  LOCATION_PERSIST_MIN_INTERVAL_MS,
  shouldPersistLocation,
} from '../location-tracking.utils';

describe('shouldPersistLocation', () => {
  it('allows first location sample', () => {
    expect(shouldPersistLocation(undefined, 1_000)).toBe(true);
  });

  it('skips sample inside throttle window', () => {
    expect(
      shouldPersistLocation(10_000, 10_000 + LOCATION_PERSIST_MIN_INTERVAL_MS - 1)
    ).toBe(false);
  });

  it('allows sample after throttle window', () => {
    expect(
      shouldPersistLocation(10_000, 10_000 + LOCATION_PERSIST_MIN_INTERVAL_MS)
    ).toBe(true);
  });
});
