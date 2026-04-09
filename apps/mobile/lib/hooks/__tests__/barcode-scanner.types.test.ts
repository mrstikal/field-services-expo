import {
  isBarcodeType,
  SUPPORTED_BARCODE_TYPES,
} from '../barcode-scanner.types';

describe('barcode-scanner.types', () => {
  it('accepts all configured camera barcode types', () => {
    for (const type of SUPPORTED_BARCODE_TYPES) {
      expect(isBarcodeType(type)).toBe(true);
    }
  });

  it('rejects outdated or invalid barcode type labels', () => {
    expect(isBarcodeType('data_MATRIX')).toBe(false);
    expect(isBarcodeType('ean-13')).toBe(false);
    expect(isBarcodeType('')).toBe(false);
  });
});
