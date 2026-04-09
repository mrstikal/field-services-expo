import { describe, expect, it, vi } from 'vitest';
import {
  appendPhoto,
  createPhotoId,
  createReportId,
  removePhotoById,
} from '../create.utils';

describe('createPhotoId', () => {
  it('uses randomUUID when available', () => {
    const result = createPhotoId(() => 'generated-uuid');

    expect(result).toBe('generated-uuid');
  });

  it('falls back to timestamp-based id when randomUUID is unavailable', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const result = createPhotoId(null);

    expect(result).toBe('photo-1700000000000-4fzzzxjy');
  });
});

describe('createReportId', () => {
  it('uses randomUUID when available', () => {
    const result = createReportId(() => 'report-uuid');

    expect(result).toBe('report-uuid');
  });

  it('falls back to UUID format when randomUUID is unavailable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const result = createReportId(null);

    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe('photo list helpers', () => {
  it('appends photo when list is below max', () => {
    const result = appendPhoto([{ id: '1' }], { id: '2' }, 10);

    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('keeps list unchanged when max limit is reached', () => {
    const photos = Array.from({ length: 2 }, (_, index) => ({
      id: String(index + 1),
    }));

    const result = appendPhoto(photos, { id: '3' }, 2);

    expect(result).toEqual(photos);
  });

  it('removes photo by id', () => {
    const result = removePhotoById(
      [
        { id: '1' },
        { id: '2' },
      ],
      '1'
    );

    expect(result).toEqual([{ id: '2' }]);
  });
});
