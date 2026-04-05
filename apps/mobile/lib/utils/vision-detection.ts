import * as FileSystem from 'expo-file-system/legacy';

/**
 * Interface for Vision API response
 */
export interface BoundingPoly {
  vertices: Array<{ x: number; y: number }>;
}

export interface VisionDetectionResult {
  labels: Array<{ text: string; confidence: number }>;
  objects: Array<{ name: string; confidence: number; boundingPoly: BoundingPoly }>;
  text?: string;
}

export interface LabelAnnotation {
  description: string;
  score: number;
}

export interface LocalizedObjectAnnotation {
  name: string;
  score: number;
  boundingPoly: BoundingPoly;
}

/**
 * Detect objects in an image using Google Cloud Vision API
 * @param imageUri URI of the image to analyze
 * @returns Promise with detection results
 */
export async function detectObjects(imageUri: string): Promise<VisionDetectionResult | null> {
  try {
    // Get image data
    const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Google Cloud Vision API endpoint
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      console.warn('Google Cloud API key not configured');
      return null;
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
              image: {
                content: imageBase64,
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.responses[0];

    // Process labels
    const labels = (results.labelAnnotations || []).map((label: LabelAnnotation) => ({
      text: label.description,
      confidence: label.score,
    }));

    // Process objects
    const objects = (results.localizedObjectAnnotations || []).map((obj: LocalizedObjectAnnotation) => ({
      name: obj.name,
      confidence: obj.score,
      boundingPoly: obj.boundingPoly,
    }));

    return {
      labels,
      objects,
    };
  } catch (error) {
    console.error('Error detecting objects:', error);
    return null;
  }
}

/**
 * Extract text from an image using OCR
 * @param imageUri URI of the image to analyze
 * @returns Promise with extracted text
 */
export async function extractText(imageUri: string): Promise<string | null> {
  try {
    const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      console.warn('Google Cloud API key not configured');
      return null;
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
              image: {
                content: imageBase64,
              },
              features: [
                { type: 'TEXT_DETECTION', maxResults: 1 },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textAnnotations = data.responses[0].textAnnotations;

    return textAnnotations && textAnnotations.length > 0
      ? textAnnotations[0].description
      : null;
  } catch (error) {
    console.error('Error extracting text:', error);
    return null;
  }
}

/**
 * Suggest form fields based on detection results
 * @param results Vision detection results
 * @returns Array of suggested form fields with values
 */
export function suggestFormFields(results: VisionDetectionResult): Array<{ fieldId: string; value: string | number }> {
  const suggestions: Array<{ fieldId: string; value: string | number }> = [];

  // Suggest parts based on detected objects
  if (results.objects) {
    const partMatches = results.objects.filter(
      (obj) => obj.confidence > 0.7
    );

    if (partMatches.length > 0) {
      suggestions.push({
        fieldId: 'parts_replaced',
        value: partMatches.map((obj) => obj.name).join(', '),
      });
    }
  }

  // Suggest fault type based on labels
  if (results.labels) {
    const electricalLabels = results.labels.filter(
      (label) =>
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