import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { TaskCategory } from '@field-service/shared-types';
import { formTemplates } from '@/lib/validators/report-schemas';

export interface ReportData {
  id: string;
  taskTitle: string;
  taskDescription: string;
  taskAddress: string;
  customerName: string;
  customerPhone: string;
  technicianName: string;
  technicianId: string;
  photos: string[]; // Array of public URLs from storage
  formData: Record<string, unknown>;
  taskCategory?: TaskCategory;
  signature: string | null; // Public URL from storage or base64 data URI
  createdAt: string;
  completedAt: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMimeTypeFromPath(path: string, fallback: string): string {
  const normalizedPath = path.split('?')[0].toLowerCase();

  if (normalizedPath.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedPath.endsWith('.gif')) {
    return 'image/gif';
  }

  if (normalizedPath.endsWith('.webp')) {
    return 'image/webp';
  }

  return fallback;
}

function formatFormValue(
  value: unknown,
  field?: {
    type: string;
    options?: Array<{ label: string; value: string | number }>;
  }
): string {
  if (value === undefined || value === null) {
    return 'N/A';
  }

  if (!field) {
    return String(value);
  }

  switch (field.type) {
    case 'checkbox':
      return value ? 'Yes' : 'No';
    case 'select': {
      const option = field.options?.find(option => option.value === value);
      return option ? option.label : String(value);
    }
    case 'number':
      return Number(value).toFixed(2);
    default:
      return String(value);
  }
}

function buildFormDataHtml(data: ReportData): string {
  if (data.taskCategory && formTemplates[data.taskCategory]) {
    const template = formTemplates[data.taskCategory];
    const rows = template.fields
      .map(field => {
        const value = data.formData[field.id];
        if (value === undefined || value === null) {
          return null;
        }

        return `
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(field.label)}</div>
            <div class="detail-value">${escapeHtml(
              formatFormValue(value, field)
            )}</div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    return rows || '<p class="empty-state">No report details available.</p>';
  }

  const rows = Object.entries(data.formData)
    .map(([key, value]) => {
      if (value === undefined || value === null) {
        return null;
      }

      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());

      return `
        <div class="detail-row">
          <div class="detail-label">${escapeHtml(label)}</div>
          <div class="detail-value">${escapeHtml(formatFormValue(value))}</div>
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  return rows || '<p class="empty-state">No report details available.</p>';
}

async function resolveImageSource(
  uri: string,
  fallbackMimeType: string
): Promise<string> {
  if (!uri) {
    return uri;
  }

  if (
    uri.startsWith('data:') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return uri;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return `data:${getMimeTypeFromPath(uri, fallbackMimeType)};base64,${base64}`;
  } catch (error) {
    console.warn('Failed to inline image for PDF generation:', error);
    return uri;
  }
}

/**
 * Generate HTML content for PDF report
 */
export function generateReportHTML(data: ReportData): string {
  const photosHtml = data.photos
    .map(
      photo =>
        `<div class="photo-card"><img src="${escapeHtml(photo)}" class="photo" /></div>`
    )
    .join('');

  const formDataHtml = buildFormDataHtml(data);
  const signatureHtml = data.signature
    ? `<div class="section signature-section">
         <h2>Customer Signature</h2>
         <div class="signature-box">
           <img src="${escapeHtml(data.signature)}" class="signature-image" />
         </div>
       </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Report #${escapeHtml(data.id)}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 2px solid #1e40af;
        }
        .header h1 {
          color: #1e40af;
          margin: 0;
          font-size: 28px;
        }
        .header p {
          color: #6b7280;
          margin: 4px 0 0;
        }
        .section {
          margin-bottom: 24px;
        }
        .section h2 {
          color: #1f2937;
          font-size: 18px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row {
          display: flex;
          margin-bottom: 8px;
        }
        .info-label {
          font-weight: 600;
          color: #6b7280;
          min-width: 120px;
        }
        .info-value {
          color: #1f2937;
        }
        .detail-row {
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .detail-value {
          color: #111827;
          font-weight: 600;
          word-break: break-word;
        }
        .photos {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .photo-card {
          width: 180px;
        }
        .photo {
          width: 180px;
          height: 180px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          display: block;
        }
        .signature-section {
          page-break-inside: avoid;
        }
        .signature-box {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          background: #f9fafb;
        }
        .signature-image {
          max-width: 200px;
          max-height: 120px;
          display: block;
        }
        .empty-state {
          color: #6b7280;
          font-style: italic;
        }
        .footer {
          margin-top: 48px;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Service Report</h1>
        <p>Report ID: ${escapeHtml(data.id)} | ${escapeHtml(formatDate(data.createdAt))}</p>
      </div>

      <div class="section">
        <h2>Task Details</h2>
        <p><strong>Title:</strong> ${escapeHtml(data.taskTitle)}</p>
        <p><strong>Description:</strong> ${escapeHtml(data.taskDescription)}</p>
        <p><strong>Address:</strong> ${escapeHtml(data.taskAddress)}</p>
      </div>

      <div class="section">
        <h2>Customer Information</h2>
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${escapeHtml(data.customerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone:</span>
          <span class="info-value">${escapeHtml(data.customerPhone)}</span>
        </div>
      </div>

      <div class="section">
        <h2>Technician Information</h2>
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${escapeHtml(data.technicianName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ID:</span>
          <span class="info-value">${escapeHtml(data.technicianId)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Completed:</span>
          <span class="info-value">${escapeHtml(formatDate(data.completedAt))}</span>
        </div>
      </div>

      <div class="section">
        <h2>Report Details</h2>
        ${formDataHtml}
      </div>

      <div class="section">
        <h2>Photo Documentation</h2>
        <div class="photos">
          ${photosHtml || '<p class="empty-state">No photos attached.</p>'}
        </div>
      </div>

      ${signatureHtml}

      <div class="footer">
        <p>Generated by Field Service App</p>
        <p>Report ID: ${escapeHtml(data.id)}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate PDF from report data
 * @param data Report data to include in PDF
 * @returns Promise with PDF file URI
 */
export async function generatePDF(data: ReportData): Promise<string> {
  try {
    const [photos, signature] = await Promise.all([
      Promise.all(
        data.photos.map(photo => resolveImageSource(photo, 'image/jpeg'))
      ),
      data.signature
        ? resolveImageSource(data.signature, 'image/png')
        : Promise.resolve(null),
    ]);
    const html = generateReportHTML({
      ...data,
      photos,
      signature,
    });

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Share PDF file
 * @param uri URI of the PDF file to share
 */
export async function sharePDF(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Report',
      UTI: '.pdf',
    });
  } catch (error) {
    console.error('Error sharing PDF:', error);
    throw new Error('Failed to share PDF');
  }
}

/**
 * Save PDF to file system
 * @param uri URI of the PDF file to save
 * @param filename Filename for the saved PDF
 * @returns Promise with saved file URI
 */
export async function savePDF(uri: string, filename: string): Promise<string> {
  try {
    const destinationUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw new Error('Failed to save PDF');
  }
}

/**
 * Delete PDF file
 * @param uri URI of the PDF file to delete
 */
export async function deletePDF(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri);
  } catch (error) {
    console.error('Error deleting PDF:', error);
  }
}
