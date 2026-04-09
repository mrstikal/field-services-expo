import { NextRequest, NextResponse } from 'next/server';
import { logApiError } from '@/lib/api-errors';
import { requireBearerUser } from '@/lib/server-supabase';

type VisionAction = 'detect' | 'extractText';

interface VisionRequestBody {
  action: VisionAction;
  imageBase64: string;
}

interface VisionApiErrorPayload {
  error?: {
    message?: string;
    code?: number;
  };
}

interface VisionLabelAnnotation {
  description: string;
  score: number;
}

interface VisionObjectAnnotation {
  name: string;
  score: number;
  boundingPoly: {
    vertices: Array<{ x?: number; y?: number }>;
  };
}

interface VisionTextAnnotation {
  description: string;
}

interface VisionAnnotateResult {
  error?: { code?: number; message?: string };
  labelAnnotations?: VisionLabelAnnotation[];
  localizedObjectAnnotations?: VisionObjectAnnotation[];
  textAnnotations?: VisionTextAnnotation[];
}

interface VisionAnnotateResponse {
  responses?: VisionAnnotateResult[];
}

function getGoogleVisionApiKey() {
  return process.env.GOOGLE_CLOUD_API_KEY;
}

function parseVisionRequestBody(value: unknown): VisionRequestBody | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<VisionRequestBody>;
  const isValidAction =
    candidate.action === 'detect' || candidate.action === 'extractText';
  const hasBase64 =
    typeof candidate.imageBase64 === 'string' &&
    candidate.imageBase64.length > 0;

  if (!isValidAction || !hasBase64) return null;
  const action = candidate.action as VisionAction;
  const imageBase64 = candidate.imageBase64 as string;

  return {
    action,
    imageBase64,
  };
}

function getFeaturesForAction(action: VisionAction) {
  if (action === 'extractText') {
    return [{ type: 'TEXT_DETECTION', maxResults: 1 }];
  }

  return [
    { type: 'LABEL_DETECTION', maxResults: 10 },
    { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
  ];
}

function getHttpErrorDetail(
  payload: string,
  statusText: string
): { detail: string } {
  if (!payload) return { detail: statusText || 'Unknown error' };

  try {
    const parsed = JSON.parse(payload) as VisionApiErrorPayload;
    const detail = parsed.error?.message || statusText || payload;
    return { detail };
  } catch {
    return { detail: payload };
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const bearerToken = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : '';

    if (!bearerToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { user } = await requireBearerUser(bearerToken);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const apiKey = getGoogleVisionApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Cloud Vision API key is not configured.' },
        { status: 503 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const body = parseVisionRequestBody(rawBody);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid Vision request payload.' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: body.imageBase64 },
              features: getFeaturesForAction(body.action),
            },
          ],
        }),
      }
    );

    const rawResponse = await response.text();
    if (!response.ok) {
      const { detail } = getHttpErrorDetail(rawResponse, response.statusText);
      return NextResponse.json(
        { error: `Vision API error (${response.status}): ${detail}` },
        { status: 502 }
      );
    }

    const parsed = rawResponse
      ? (JSON.parse(rawResponse) as VisionAnnotateResponse)
      : {};
    const result = parsed.responses?.[0];
    if (result?.error) {
      const code =
        typeof result.error.code === 'number' ? ` (${result.error.code})` : '';
      const message = result.error.message || 'Unknown API error';
      return NextResponse.json(
        { error: `Vision API response error${code}: ${message}` },
        { status: 502 }
      );
    }

    if (body.action === 'extractText') {
      const textAnnotations = result?.textAnnotations;
      return NextResponse.json({
        text:
          textAnnotations && textAnnotations.length > 0
            ? (textAnnotations[0].description as string)
            : null,
      });
    }

    const labels = ((result?.labelAnnotations || []) as VisionLabelAnnotation[]).map(
      label => ({
        text: label.description,
        confidence: label.score,
      })
    );

    const objects = (
      (result?.localizedObjectAnnotations || []) as VisionObjectAnnotation[]
    ).map(obj => ({
      name: obj.name,
      confidence: obj.score,
      boundingPoly: {
        vertices: (obj.boundingPoly?.vertices || []).map(vertex => ({
          x: typeof vertex.x === 'number' ? vertex.x : 0,
          y: typeof vertex.y === 'number' ? vertex.y : 0,
        })),
      },
    }));

    return NextResponse.json({ labels, objects });
  } catch (error) {
    logApiError('vision:analyze', error);
    return NextResponse.json(
      { error: 'Unable to analyze image.' },
      { status: 500 }
    );
  }
}
