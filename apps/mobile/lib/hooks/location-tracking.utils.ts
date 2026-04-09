export const LOCATION_PERSIST_MIN_INTERVAL_MS = 5_000;

export function shouldPersistLocation(
  lastPersistTimestamp: number | undefined,
  currentTimestamp: number,
  minIntervalMs: number = LOCATION_PERSIST_MIN_INTERVAL_MS
): boolean {
  if (!Number.isFinite(currentTimestamp) || currentTimestamp <= 0) {
    return false;
  }

  if (
    lastPersistTimestamp === undefined ||
    currentTimestamp - lastPersistTimestamp >= minIntervalMs
  ) {
    return true;
  }

  return false;
}
