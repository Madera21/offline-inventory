export function wholeQuantity(value: string | number, allowZero = false): number {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) throw new Error('Enter a whole quantity.');
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < (allowZero ? 0 : 1)) throw new Error('Enter a valid whole quantity.');
  return quantity;
}

export function minorAmount(value: number, allowZero = false): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new Error('Enter a valid amount.');
  return value;
}

/** Parse a user-entered amount exactly, rejecting partial and negative values. */
export function parseStoreAmount(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Enter an amount with up to two decimal places.');
  const [major, fraction = ''] = trimmed.split('.');
  return minorAmount(Number(major) * 100 + Number(fraction.padEnd(2, '0')), true);
}
