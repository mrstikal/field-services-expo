import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

// Supabase Storage Configuration
const STORAGE_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_S3_BUCKET || 'FieldService';

if (!STORAGE_BUCKET) {
  console.warn('Storage bucket not configured. File uploads will fail.');
}

/**
 * Generate a unique filename for uploaded file
 */
function generateFilename(originalName: string, prefix: string = ''): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop() || 'jpg';
  return `${prefix}-${timestamp}-${random}.${ext}`;
}

/**
 * Upload a file to Supabase Storage
 * @param fileUri Local file URI to upload
 * @param remotePath Path in storage bucket (e.g., 'reports/123/photo.jpg')
 * @returns Promise with public URL of uploaded file
 */
export async function uploadFileToStorage(
  fileUri: string,
  remotePath: string
): Promise<string> {
  if (!STORAGE_BUCKET) {
    throw new Error('Storage bucket not configured');
  }

  try {
    const fileStats = await FileSystem.getInfoAsync(fileUri);
    if (!fileStats.exists) {
      throw new Error(`File does not exist: ${fileUri}`);
    }

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });

    // Get file extension
    const ext = remotePath.split('.').pop() || 'jpg';
    const mimeType = getMimeType(ext);

    // Convert base64 string to binary data (Uint8Array)
    // This is necessary because Supabase expects binary data, not base64 string
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage using the client
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(remotePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upload failed: No data returned');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(remotePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading file to Supabase Storage:', error);
    throw error;
  }
}

/**
 * Upload a photo to storage
 * @param fileUri Local file URI
 * @param reportId Report ID for organization
 * @returns Promise with public URL
 */
export async function uploadPhoto(
  fileUri: string,
  reportId: string
): Promise<string> {
  const filename = generateFilename(fileUri, 'photo');
  const remotePath = `reports/${reportId}/photos/${filename}`;
  return uploadFileToStorage(fileUri, remotePath);
}

/**
 * Upload a signature image to storage
 * @param base64Data Base64 encoded image data (with data URI prefix)
 * @param reportId Report ID for organization
 * @returns Promise with public URL
 */
export async function uploadSignature(
  base64Data: string,
  reportId: string
): Promise<string> {
  // Remove data URI prefix if present
  const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const filename = generateFilename('signature.png', 'signature');
  const remotePath = `reports/${reportId}/${filename}`;

  // Create temporary file from base64
  const tempFileUri = `${FileSystem.cacheDirectory}signature_${reportId}.png`;
  await FileSystem.writeAsStringAsync(tempFileUri, base64String, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    const url = await uploadFileToStorage(tempFileUri, remotePath);
    return url;
  } finally {
    // Clean up temp file
    await FileSystem.deleteAsync(tempFileUri).catch(() => {});
  }
}

/**
 * Upload a PDF file to storage
 * @param fileUri Local file URI
 * @param reportId Report ID for organization
 * @returns Promise with public URL
 */
export async function uploadPDF(
  fileUri: string,
  reportId: string
): Promise<string> {
  const filename = `report-${reportId}.pdf`;
  const remotePath = `reports/${reportId}/${filename}`;
  return uploadFileToStorage(fileUri, remotePath);
}

/**
 * Delete a file from storage
 * @param remotePath Path in storage bucket
 */
export async function deleteFileFromStorage(remotePath: string): Promise<void> {
  if (!STORAGE_BUCKET) {
    console.warn('Storage bucket not configured. Cannot delete file.');
    return;
  }

  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([remotePath]);

    if (error) {
      console.error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting file from Supabase Storage:', error);
  }
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}