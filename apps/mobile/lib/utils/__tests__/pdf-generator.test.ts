import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external dependencies BEFORE importing the module under test
vi.mock('expo-print', () => ({
  printToFileAsync: vi.fn(() => Promise.resolve({ uri: 'file://test.pdf' })),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(() => Promise.resolve(true)),
  shareAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://documents/',
  copyAsync: vi.fn(() => Promise.resolve()),
  deleteAsync: vi.fn(() => Promise.resolve()),
  getInfoAsync: vi.fn(() => Promise.resolve({ exists: true })),
}));

import {
  generateReportHTML,
  generatePDF,
  sharePDF,
  savePDF,
  deletePDF,
} from '@lib/utils/pdf-generator';
import type { ReportData } from '@lib/utils/pdf-generator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

describe('PDF Generator', () => {
  describe('generateReportHTML', () => {
    it('should generate HTML with all data', () => {
      const data: ReportData = {
        id: 'report-1',
        taskTitle: 'Repair Electrical Panel',
        taskDescription: 'Fix electrical panel issue',
        taskAddress: '123 Main St',
        customerName: 'John Doe',
        customerPhone: '123456789',
        technicianName: 'Tech 1',
        technicianId: 'tech-1',
        photos: ['photo1.jpg', 'photo2.jpg'],
        signature: 'signature.png',
        formData: {
          fault_type: 'electrical',
          fault_description: 'Circuit breaker tripping',
          voltage: '240',
          current: '16',
          parts_replaced: 'Circuit breaker 16A',
          repair_time: '2',
          test_results: 'passed',
          additional_notes: 'Replaced faulty breaker',
        },
        createdAt: '2025-01-01T10:00:00.000Z',
        completedAt: '2025-01-01T12:00:00.000Z',
      };

      const html = generateReportHTML(data);

      expect(html).toContain('Repair Electrical Panel');
      expect(html).toContain('John Doe');
      expect(html).toContain('123 Main St');
      expect(html).toContain('Tech 1');
      expect(html).toContain('January 1, 2025');
      expect(html).toContain('photo1.jpg');
      expect(html).toContain('signature.png');
      expect(html).toContain('electrical');
      expect(html).toContain('Circuit breaker tripping');
    });

    it('should handle empty photos array', () => {
      const data: ReportData = {
        id: 'report-2',
        taskTitle: 'Repair Electrical Panel',
        taskDescription: 'Fix electrical panel issue',
        taskAddress: '123 Main St',
        customerName: 'John Doe',
        customerPhone: '123456789',
        technicianName: 'Tech 1',
        technicianId: 'tech-1',
        photos: [],
        signature: null,
        formData: {
          fault_type: 'electrical',
          fault_description: 'Circuit breaker tripping',
          voltage: '240',
          current: '16',
          parts_replaced: 'Circuit breaker 16A',
          repair_time: '2',
          test_results: 'passed',
          additional_notes: 'Replaced faulty breaker',
        },
        createdAt: '2025-01-01T10:00:00.000Z',
        completedAt: '2025-01-01T12:00:00.000Z',
      };

      const html = generateReportHTML(data);

      expect(html).toContain('Repair Electrical Panel');
      expect(html).not.toContain('photo1.jpg');
    });

    it('should handle null signature', () => {
      const data: ReportData = {
        id: 'report-3',
        taskTitle: 'Repair Electrical Panel',
        taskDescription: 'Fix electrical panel issue',
        taskAddress: '123 Main St',
        customerName: 'John Doe',
        customerPhone: '123456789',
        technicianName: 'Tech 1',
        technicianId: 'tech-1',
        photos: ['photo1.jpg'],
        signature: null,
        formData: {
          fault_type: 'electrical',
          fault_description: 'Circuit breaker tripping',
          voltage: '240',
          current: '16',
          parts_replaced: 'Circuit breaker 16A',
          repair_time: '2',
          test_results: 'passed',
          additional_notes: 'Replaced faulty breaker',
        },
        createdAt: '2025-01-01T10:00:00.000Z',
        completedAt: '2025-01-01T12:00:00.000Z',
      };

      const html = generateReportHTML(data);

      expect(html).toContain('Repair Electrical Panel');
      expect(html).not.toContain('signature.png');
    });
  });

  describe('generatePDF', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should generate PDF and return URI', async () => {
      const data: ReportData = {
        id: 'report-4',
        taskTitle: 'Repair Electrical Panel',
        taskDescription: 'Fix electrical panel issue',
        taskAddress: '123 Main St',
        customerName: 'John Doe',
        customerPhone: '123456789',
        technicianName: 'Tech 1',
        technicianId: 'tech-1',
        photos: ['photo1.jpg'],
        signature: 'signature.png',
        formData: {
          fault_type: 'electrical',
          fault_description: 'Circuit breaker tripping',
          voltage: '240',
          current: '16',
          parts_replaced: 'Circuit breaker 16A',
          repair_time: '2',
          test_results: 'passed',
          additional_notes: 'Replaced faulty breaker',
        },
        createdAt: '2025-01-01T10:00:00.000Z',
        completedAt: '2025-01-01T12:00:00.000Z',
      };

      const mockUri = 'file:///tmp/report.pdf';
      vi.mocked(Print.printToFileAsync).mockResolvedValue({
        uri: mockUri,
      } as never);

      const result = await generatePDF(data);

      expect(result).toBe(mockUri);
      expect(Print.printToFileAsync).toHaveBeenCalledWith({
        html: expect.any(String),
        base64: false,
      });
    });

    it('should throw error if PDF generation fails', async () => {
      const data: ReportData = {
        id: 'report-5',
        taskTitle: 'Repair Electrical Panel',
        taskDescription: 'Fix electrical panel issue',
        taskAddress: '123 Main St',
        customerName: 'John Doe',
        customerPhone: '123456789',
        technicianName: 'Tech 1',
        technicianId: 'tech-1',
        photos: ['photo1.jpg'],
        signature: 'signature.png',
        formData: {
          fault_type: 'electrical',
          fault_description: 'Circuit breaker tripping',
          voltage: '240',
          current: '16',
          parts_replaced: 'Circuit breaker 16A',
          repair_time: '2',
          test_results: 'passed',
          additional_notes: 'Replaced faulty breaker',
        },
        createdAt: '2025-01-01T10:00:00.000Z',
        completedAt: '2025-01-01T12:00:00.000Z',
      };

      vi.mocked(Print.printToFileAsync).mockRejectedValue(
        new Error('Print failed')
      );

      await expect(generatePDF(data)).rejects.toThrow('Failed to generate PDF');
    });
  });

  describe('sharePDF', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should share PDF', async () => {
      const uri = 'file:///tmp/report.pdf';

      vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      vi.mocked(Sharing.shareAsync).mockResolvedValue(undefined as never);

      await sharePDF(uri);

      expect(Sharing.isAvailableAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Report',
        UTI: '.pdf',
      });
    });

    it('should throw error if sharing is not available', async () => {
      const uri = 'file:///tmp/report.pdf';

      vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);

      await expect(sharePDF(uri)).rejects.toThrow('Sharing is not available');
    });

    it('should throw error if sharing fails', async () => {
      const uri = 'file:///tmp/report.pdf';

      vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      vi.mocked(Sharing.shareAsync).mockRejectedValue(
        new Error('Share failed')
      );

      await expect(sharePDF(uri)).rejects.toThrow('Failed to share PDF');
    });
  });

  describe('savePDF', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should save PDF to file system', async () => {
      const uri = 'file:///tmp/report.pdf';
      const filename = 'report.pdf';
      const expectedDestination = 'file://documents/report.pdf';

      vi.mocked(FileSystem.copyAsync).mockResolvedValue(undefined as never);

      const result = await savePDF(uri, filename);

      expect(result).toBe(expectedDestination);
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: uri,
        to: expectedDestination,
      });
    });

    it('should throw error if save fails', async () => {
      const uri = 'file:///tmp/report.pdf';
      const filename = 'report.pdf';

      vi.mocked(FileSystem.copyAsync).mockRejectedValue(
        new Error('Copy failed')
      );

      await expect(savePDF(uri, filename)).rejects.toThrow(
        'Failed to save PDF'
      );
    });
  });

  describe('deletePDF', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should delete PDF', async () => {
      const uri = 'file:///tmp/report.pdf';

      vi.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined as never);

      await deletePDF(uri);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(uri);
    });

    it('should handle error silently', async () => {
      const uri = 'file:///tmp/report.pdf';

      vi.mocked(FileSystem.deleteAsync).mockRejectedValue(
        new Error('Delete failed')
      );

      // Should not throw
      await deletePDF(uri);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(uri);
    });
  });
});
