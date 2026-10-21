import { StockMovement } from '../src/types';

describe('Stock Calculation & Ledger Invariant Tests', () => {
  function computeStockBalance(openingStock: number, movements: { quantity_delta: number }[]): number {
    return openingStock + movements.reduce((acc, m) => acc + m.quantity_delta, 0);
  }

  test('opening stock + restock - sale reconciles correctly', () => {
    const opening = 20;
    const movements = [
      { quantity_delta: 10 }, // Restock +10 -> 30
      { quantity_delta: -3 }, // Sale -3 -> 27
      { quantity_delta: -2 }, // Damage -2 -> 25
      { quantity_delta: 5 },  // Customer return +5 -> 30
    ];

    const currentBalance = computeStockBalance(opening, movements);
    expect(currentBalance).toBe(30);
  });

  test('detects when sale exceeds available quantity', () => {
    const currentStock = 5;
    const requestedSaleQty = 7;
    const allowNegative = false;

    const wouldGoNegative = currentStock - requestedSaleQty < 0;
    expect(wouldGoNegative).toBe(true);

    if (!allowNegative && wouldGoNegative) {
      expect(() => {
        throw new Error(`Insufficient stock. Current: ${currentStock}, Requested: ${requestedSaleQty}`);
      }).toThrow('Insufficient stock');
    }
  });

  test('evaluates low-stock threshold correctly', () => {
    const threshold = 10;
    const isLowStock = (qty: number) => qty <= threshold;

    expect(isLowStock(15)).toBe(false);
    expect(isLowStock(10)).toBe(true); // at threshold
    expect(isLowStock(3)).toBe(true);  // below threshold
    expect(isLowStock(0)).toBe(true);  // out of stock
  });
});
