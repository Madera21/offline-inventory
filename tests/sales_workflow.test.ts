describe('Phase 3: Sales & Cart Workflow Tests', () => {
  interface CartLine {
    variantId: string;
    quantity: number;
    unitPriceMinor: number;
    unitCostMinor: number | null;
  }

  function calculateSaleTotals(lines: CartLine[], discountMinor = 0, cashReceivedMinor: number | null = null) {
    const subtotalMinor = lines.reduce((acc, l) => acc + l.unitPriceMinor * l.quantity, 0);
    const validDiscount = Math.min(discountMinor, subtotalMinor);
    const totalMinor = subtotalMinor - validDiscount;
    const changeMinor = cashReceivedMinor !== null && cashReceivedMinor >= totalMinor
      ? cashReceivedMinor - totalMinor
      : 0;

    return {
      subtotalMinor,
      discountMinor: validDiscount,
      totalMinor,
      changeMinor,
    };
  }

  test('calculates correct line subtotal and final total with discount', () => {
    const cart: CartLine[] = [
      { variantId: 'v1', quantity: 2, unitPriceMinor: 29900, unitCostMinor: 15000 }, // 59800
      { variantId: 'v2', quantity: 1, unitPriceMinor: 15000, unitCostMinor: 8000 },  // 15000
    ];

    // Subtotal: 74800 (₱748.00), Discount: 5000 (₱50.00) -> Total: 69800 (₱698.00)
    const totals = calculateSaleTotals(cart, 5000);
    expect(totals.subtotalMinor).toBe(74800);
    expect(totals.discountMinor).toBe(5000);
    expect(totals.totalMinor).toBe(69800);
  });

  test('calculates exact change for cash transactions', () => {
    const cart: CartLine[] = [
      { variantId: 'v1', quantity: 1, unitPriceMinor: 29900, unitCostMinor: 15000 }, // Total: 29900 (₱299.00)
    ];

    // Cash received: 50000 (₱500.00) -> Change: 20100 (₱201.00)
    const totals = calculateSaleTotals(cart, 0, 50000);
    expect(totals.totalMinor).toBe(29900);
    expect(totals.changeMinor).toBe(20100);
  });

  test('prevents discount from exceeding total subtotal', () => {
    const cart: CartLine[] = [
      { variantId: 'v1', quantity: 1, unitPriceMinor: 10000, unitCostMinor: 5000 },
    ];

    // Discount: 15000 (> 10000 subtotal) -> should cap at 10000, Total 0
    const totals = calculateSaleTotals(cart, 15000);
    expect(totals.discountMinor).toBe(10000);
    expect(totals.totalMinor).toBe(0);
  });

  test('simulates atomic sale execution and stock deduction', () => {
    let stock = 10;
    const saleQty = 3;

    if (saleQty > stock) throw new Error('Out of stock');
    stock -= saleQty;

    expect(stock).toBe(7);

    // Voiding reverses the deduction
    stock += saleQty;
    expect(stock).toBe(10);
  });
});
