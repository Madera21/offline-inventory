import { formatMoney, parseMoneyToMinor, minorToDecimalString } from '../src/utils/currency';

describe('Currency Utility Tests', () => {
  test('formats minor units to PHP currency string correctly', () => {
    expect(formatMoney(29900)).toBe('₱299.00');
    expect(formatMoney(1050)).toBe('₱10.50');
    expect(formatMoney(0)).toBe('₱0.00');
    expect(formatMoney(123456789)).toBe('₱1,234,567.89');
  });

  test('handles null, undefined, or NaN safely', () => {
    expect(formatMoney(null)).toBe('₱0.00');
    expect(formatMoney(undefined)).toBe('₱0.00');
    expect(formatMoney(NaN)).toBe('₱0.00');
  });

  test('parses decimal string and formatted input to integer minor units', () => {
    expect(parseMoneyToMinor('299.00')).toBe(29900);
    expect(parseMoneyToMinor('₱299.00')).toBe(29900);
    expect(parseMoneyToMinor('1,250.50')).toBe(125050);
    expect(parseMoneyToMinor('0.99')).toBe(99);
    expect(parseMoneyToMinor('')).toBe(0);
    expect(parseMoneyToMinor('invalid')).toBe(0);
  });

  test('converts minor units back to decimal string for inputs', () => {
    expect(minorToDecimalString(29900)).toBe('299.00');
    expect(minorToDecimalString(50)).toBe('0.50');
    expect(minorToDecimalString(0)).toBe('0.00');
    expect(minorToDecimalString(null)).toBe('');
  });
});
