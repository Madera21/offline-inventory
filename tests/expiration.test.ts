import { expirationStatus, matchesExpirationFilter, normalizeExpirationDate } from '../src/utils/expiration';
import { expirationDateSchema } from '../src/validation/product.schema';

const today = new Date(2026, 9, 24, 23, 59);

describe('Expiration calendar dates', () => {
  test.each([undefined, null, '', '  '])('keeps an optional date empty: %s', value => {
    expect(normalizeExpirationDate(value)).toBeNull();
  });
  test.each(['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '10/24/2026', '2026-1-01', '2026-10-24T00:00:00Z'])('rejects invalid dates: %s', value => {
    expect(() => normalizeExpirationDate(value)).toThrow();
    expect(expirationDateSchema.safeParse(value).success).toBe(false);
  });
  test('accepts leap days and trims valid dates', () => {
    expect(normalizeExpirationDate(' 2028-02-29 ')).toBe('2028-02-29');
  });
  test.each([
    ['2026-10-23', 'expired'], ['2026-10-24', 'today'], ['2026-10-25', 'soon'],
    ['2026-11-23', 'soon'], ['2026-11-24', 'future'], [null, null], ['invalid', null],
  ])('classifies %s as %s using the local calendar', (date, status) => {
    expect(expirationStatus(date, today)).toBe(status);
  });
  test('handles year boundaries and daylight saving without elapsed-hour arithmetic', () => {
    expect(expirationStatus('2027-01-01', new Date(2026, 11, 31, 23, 59))).toBe('soon');
    expect(expirationStatus('2026-03-09', new Date(2026, 2, 8))).toBe('soon');
  });
  test('filters only active variants with remaining stock; soon includes today', () => {
    const variant = { status: 'ACTIVE', stock_quantity: 1, expiration_date: '2026-10-24' };
    expect(matchesExpirationFilter(variant, 'soon', today)).toBe(true);
    expect(matchesExpirationFilter(variant, 'expired', today)).toBe(false);
    expect(matchesExpirationFilter({ ...variant, expiration_date: '2026-10-23' }, 'expired', today)).toBe(true);
    for (const change of [{ stock_quantity: 0 }, { stock_quantity: -1 }, { status: 'ARCHIVED' }, { expiration_date: null }]) {
      expect(matchesExpirationFilter({ ...variant, ...change }, 'soon', today)).toBe(false);
    }
  });
});
