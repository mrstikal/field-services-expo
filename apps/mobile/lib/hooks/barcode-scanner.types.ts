export const SUPPORTED_BARCODE_TYPES = [
  'ean13',
  'qr',
  'code128',
  'code39',
  'upc_e',
  'upc_a',
  'datamatrix',
  'pdf417',
  'aztec',
] as const;

export type BarcodeType = (typeof SUPPORTED_BARCODE_TYPES)[number];

export function isBarcodeType(type: string): type is BarcodeType {
  return (SUPPORTED_BARCODE_TYPES as readonly string[]).includes(type);
}
