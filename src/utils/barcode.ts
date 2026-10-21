// UPC-A may be returned as EAN-13 (one leading zero) or GTIN-14 (two).
// Only expand standard numeric lengths; other barcodes and SKUs stay exact.
export function barcodeCandidates(code: string): string[] {
  const trimmed = code.trim();
  if (!trimmed) return [];
  const candidates = new Set([trimmed]);
  if (/^\d{12,14}$/.test(trimmed)) {
    const gtin = trimmed.padStart(14, '0');
    candidates.add(gtin);
    if (gtin.startsWith('0')) candidates.add(gtin.slice(1));
    if (gtin.startsWith('00')) candidates.add(gtin.slice(2));
  }
  return [...candidates];
}
