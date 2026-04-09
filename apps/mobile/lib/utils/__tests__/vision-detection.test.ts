import * as FileSystem from 'expo-file-system/legacy';
import {
  detectObjects,
  extractText,
  suggestFormFields,
} from '@/lib/utils/vision-detection';

vi.mock('expo-file-system/legacy', () => ({
  default: {},
  readAsStringAsync: vi.fn(),
}));

describe('vision-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    vi.mocked(FileSystem.readAsStringAsync).mockResolvedValue('base64-image');
  });

  it('calls server proxy instead of direct Google endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          labels: [{ text: 'Wire', confidence: 0.9 }],
          objects: [],
        }),
    } as Response);

    const result = await detectObjects('file://image.jpg');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/vision/analyze',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result?.labels[0].text).toBe('Wire');
  });

  it('returns null when proxy is not configured', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => JSON.stringify({ error: 'Not configured' }),
    } as Response);

    const result = await detectObjects('file://image.jpg');

    expect(result).toBeNull();
  });

  it('extracts text via server proxy', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          text: 'Detected OCR text',
        }),
    } as Response);

    const result = await extractText('file://image.jpg');

    expect(result).toBe('Detected OCR text');
  });

  it('suggests form fields from detected labels and objects', () => {
    const suggestions = suggestFormFields({
      labels: [{ text: 'Electrical panel', confidence: 0.88 }],
      objects: [
        {
          name: 'Circuit breaker',
          confidence: 0.91,
          boundingPoly: { vertices: [] },
        },
      ],
    });

    expect(suggestions).toEqual([
      { fieldId: 'parts_replaced', value: 'Circuit breaker' },
      { fieldId: 'fault_type', value: 'electrical' },
    ]);
  });
});
