import * as FileSystem from 'expo-file-system/legacy';

interface VisionApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

type VisionAction = 'detect' | 'extractText';

function getVisionProxyUrl() {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  return `${apiBaseUrl}/api/vision/analyze`;
}

function getErrorDetail(responseText: string, fallback: string) {
  if (!responseText) return fallback || 'Unknown error';

  try {
    const parsedError = JSON.parse(responseText) as {
      error?: string | VisionApiErrorPayload['error'];
    };
    if (typeof parsedError.error === 'string') return parsedError.error;
    return parsedError.error?.message || fallback || responseText;
  } catch {
    return responseText;
  }
}

async function callVisionProxy(
  action: VisionAction,
  imageBase64: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(getVisionProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      imageBase64,
    }),
  });

  const responseText = await response.text();
  if (response.status === 503) {
    console.warn('Vision API proxy is not configured');
    return null;
  }

  if (!response.ok) {
    const detail = getErrorDetail(responseText, response.statusText);
    throw new Error(
      `Vision API error (${response.status}): ${detail || 'Unknown error'}`
    );
  }

  return responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
}

/**
 * Interface for Vision API response
 */
export interface BoundingPoly {
  vertices: Array<{ x: number; y: number }>;
}

export interface VisionDetectionResult {
  labels: Array<{ text: string; confidence: number }>;
  objects: Array<{
    name: string;
    confidence: number;
    boundingPoly: BoundingPoly;
  }>;
  text?: string;
}

export interface LabelAnnotation {
  text: string;
  confidence: number;
}

export interface LocalizedObjectAnnotation {
  name: string;
  confidence: number;
  boundingPoly: BoundingPoly;
}

/**
 * Detect objects in an image using Google Cloud Vision API
 * @param imageUri URI of the image to analyze
 * @returns Promise with detection results
 */
export async function detectObjects(
  imageUri: string
): Promise<VisionDetectionResult | null> {
  const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });
  const results = await callVisionProxy('detect', imageBase64);
  if (!results) return null;

  // Process labels
  const labels = ((results.labels || []) as LabelAnnotation[]).map(label => ({
    text: label.text,
    confidence: label.confidence,
  }));

  // Process objects
  const objects = ((results.objects || []) as LocalizedObjectAnnotation[]).map(
    obj => ({
      name: obj.name,
      confidence: obj.confidence,
      boundingPoly: obj.boundingPoly,
    })
  );

  return {
    labels,
    objects,
  };
}

/**
 * Extract text from an image using OCR
 * @param imageUri URI of the image to analyze
 * @returns Promise with extracted text
 */
export async function extractText(imageUri: string): Promise<string | null> {
  const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });
  const result = await callVisionProxy('extractText', imageBase64);
  if (!result) return null;

  return typeof result.text === 'string' ? result.text : null;
}

/**
 * Suggest form fields based on detection results
 * @param results Vision detection results
 * @returns Array of suggested form fields with values
 */
export function suggestFormFields(
  results: VisionDetectionResult
): Array<{ fieldId: string; value: string | number }> {
  const suggestions: Array<{ fieldId: string; value: string | number }> = [];

  // Suggest parts based on detected objects
  if (results.objects) {
    const partMatches = results.objects.filter(obj => obj.confidence > 0.7);

    if (partMatches.length > 0) {
      suggestions.push({
        fieldId: 'parts_replaced',
        value: partMatches.map(obj => obj.name).join(', '),
      });
    }
  }

  // Suggest fault type based on labels
  if (results.labels) {
    const electricalLabels = results.labels.filter(
      label =>
        label.text.toLowerCase().includes('electrical') ||
        label.text.toLowerCase().includes('circuit') ||
        label.text.toLowerCase().includes('wire')
    );

    if (electricalLabels.length > 0) {
      suggestions.push({
        fieldId: 'fault_type',
        value: 'electrical',
      });
    }
  }

  return suggestions;
}
