/**
 * Currency utilities for handling money represented as integer minor units (e.g., centavos).
 * 1 PHP = 100 minor units.
 */

export function formatMoney(
  amountMinor: number | null | undefined,
  currencySymbol = '₱'
): string {
  if (amountMinor === null || amountMinor === undefined || isNaN(amountMinor)) {
    return `${currencySymbol}0.00`;
  }
  const isNegative = amountMinor < 0;
  const absAmount = Math.abs(amountMinor);
  const major = Math.floor(absAmount / 100);
  const minor = absAmount % 100;
  const formattedMajor = major.toLocaleString('en-US');
  const formattedMinor = minor.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${currencySymbol}${formattedMajor}.${formattedMinor}`;
}

export function parseMoneyToMinor(input: string): number {
  if (!input) return 0;
  // Remove currency symbols, commas, whitespace
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function minorToDecimalString(amountMinor: number | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined) return '';
  return (amountMinor / 100).toFixed(2);
}
