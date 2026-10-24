export type ExpirationStatus = 'expired' | 'today' | 'soon' | 'future';
export type ExpirationFilter = 'expired' | 'soon';

/** A calendar date, never a UTC timestamp. Blank means no expiration date. */
export function normalizeExpirationDate(value?: string | null): string | null {
  const date = value?.trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Enter expiration date as YYYY-MM-DD.');
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(0, 0, 0, 0);
  if (year < 1 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('Enter a valid expiration date.');
  }
  return date;
}

export function expirationStatus(value?: string | null, now = new Date()): ExpirationStatus | null {
  let date: string | null;
  try { date = normalizeExpirationDate(value); } catch { return null; }
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(0);
  target.setUTCFullYear(year, month - 1, day);
  target.setUTCHours(0, 0, 0, 0);
  const today = new Date(0);
  today.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  today.setUTCHours(0, 0, 0, 0);
  const days = (target.getTime() - today.getTime()) / 86400000;
  return days < 0 ? 'expired' : days === 0 ? 'today' : days <= 30 ? 'soon' : 'future';
}

export function matchesExpirationFilter(variant: { expiration_date?: string | null; stock_quantity: number; status: string }, filter: ExpirationFilter, now = new Date()): boolean {
  if (variant.status !== 'ACTIVE' || variant.stock_quantity <= 0) return false;
  const status = expirationStatus(variant.expiration_date, now);
  return filter === 'expired' ? status === 'expired' : status === 'today' || status === 'soon';
}
