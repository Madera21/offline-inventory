import { StockMovementType } from '../src/types';

describe('Phase 2: Variants & Stock Ledger Movement Tests', () => {
  interface MockVariant {
    id: string;
    label: string;
    stock_quantity: number;
    unit_label: string;
    low_stock_threshold: number | null;
  }

  interface MockMovement {
    id: string;
    variant_id: string;
    movement_type: StockMovementType;
    quantity_delta: number;
    reason: string | null;
  }

  let variants: MockVariant[] = [];
  let ledger: MockMovement[] = [];

  beforeEach(() => {
    variants = [
      { id: 'v1', label: 'Small', stock_quantity: 10, unit_label: 'bottle', low_stock_threshold: 5 },
      { id: 'v2', label: 'Large (1.5L)', stock_quantity: 4, unit_label: 'bottle', low_stock_threshold: 5 },
    ];
    ledger = [
      { id: 'm1', variant_id: 'v1', movement_type: 'OPENING_STOCK', quantity_delta: 10, reason: 'Initial' },
      { id: 'm2', variant_id: 'v2', movement_type: 'OPENING_STOCK', quantity_delta: 4, reason: 'Initial' },
    ];
  });

  function applyMovement(
    variantId: string,
    type: StockMovementType,
    delta: number,
    reason: string,
    allowNegative = false
  ) {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) throw new Error('Variant not found');

    const newStock = variant.stock_quantity + delta;
    if (!allowNegative && newStock < 0) {
      throw new Error(`Insufficient stock. Current: ${variant.stock_quantity}, requested delta: ${delta}`);
    }

    variant.stock_quantity = newStock;
    ledger.push({
      id: `m_${Date.now()}_${Math.random()}`,
      variant_id: variantId,
      movement_type: type,
      quantity_delta: delta,
      reason,
    });
  }

  function auditReconciliation(variantId: string): { stored: number; calculated: number; match: boolean } {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) throw new Error('Variant not found');

    const calculated = ledger
      .filter((m) => m.variant_id === variantId)
      .reduce((sum, m) => sum + m.quantity_delta, 0);

    return {
      stored: variant.stock_quantity,
      calculated,
      match: variant.stock_quantity === calculated,
    };
  }

  test('restock increases variant stock and appends ledger record', () => {
    applyMovement('v1', 'RESTOCK', 15, 'Supplier delivery PO-102');
    expect(variants[0].stock_quantity).toBe(25);

    const audit = auditReconciliation('v1');
    expect(audit.match).toBe(true);
    expect(audit.calculated).toBe(25);
  });

  test('damage deduction decreases stock correctly', () => {
    applyMovement('v1', 'DAMAGE', -3, 'Broken in transit');
    expect(variants[0].stock_quantity).toBe(7);

    const audit = auditReconciliation('v1');
    expect(audit.match).toBe(true);
    expect(audit.calculated).toBe(7);
  });

  test('blocks negative stock if damage or reduction exceeds current stock', () => {
    expect(() => {
      applyMovement('v2', 'DAMAGE', -10, 'Excess damage', false);
    }).toThrow('Insufficient stock');

    // Balance remains untouched
    expect(variants[1].stock_quantity).toBe(4);
  });

  test('reconciliation detects and fixes drift between ledger and cached stock balance', () => {
    // Simulate unintentional drift or cache de-sync
    variants[0].stock_quantity = 999;

    let audit = auditReconciliation('v1');
    expect(audit.match).toBe(false);
    expect(audit.stored).toBe(999);
    expect(audit.calculated).toBe(10);

    // Run reconciliation fix
    variants[0].stock_quantity = audit.calculated;

    audit = auditReconciliation('v1');
    expect(audit.match).toBe(true);
    expect(variants[0].stock_quantity).toBe(10);
  });

  test('identifies low stock alert based on configured variant threshold', () => {
    const isAlert = (v: MockVariant) => v.low_stock_threshold !== null && v.stock_quantity <= v.low_stock_threshold;

    expect(isAlert(variants[0])).toBe(false); // 10 > 5
    expect(isAlert(variants[1])).toBe(true);  // 4 <= 5
  });
});
