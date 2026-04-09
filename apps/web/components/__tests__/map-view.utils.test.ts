import { formatLastSeen, getLastSeenTimestamp } from '@/components/map-view.utils';

describe('map-view.utils', () => {
  it('prefers updated_at when available', () => {
    expect(
      getLastSeenTimestamp('2026-04-09T10:00:00.000Z', '2026-04-09T09:00:00.000Z')
    ).toBe('2026-04-09T10:00:00.000Z');
  });

  it('falls back to created_at when updated_at is missing', () => {
    expect(getLastSeenTimestamp(undefined, '2026-04-09T09:00:00.000Z')).toBe(
      '2026-04-09T09:00:00.000Z'
    );
  });

  it('falls back to created_at when updated_at is null', () => {
    expect(getLastSeenTimestamp(null, '2026-04-09T09:00:00.000Z')).toBe(
      '2026-04-09T09:00:00.000Z'
    );
  });

  it('falls back to created_at when updated_at is invalid', () => {
    expect(getLastSeenTimestamp('not-a-timestamp', '2026-04-09T09:00:00.000Z')).toBe(
      '2026-04-09T09:00:00.000Z'
    );
  });

  it('formats relative last seen time', () => {
    expect(
      formatLastSeen(
        '2026-04-09T10:58:30.000Z',
        new Date('2026-04-09T10:59:00.000Z')
      )
    ).toBe('Just now');
  });

  it('returns Unknown for invalid last seen time', () => {
    expect(formatLastSeen('invalid-date')).toBe('Unknown');
  });
});
