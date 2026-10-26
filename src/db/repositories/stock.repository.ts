import { withInventoryTransaction } from '../writeTransaction';
import { addBatch, consumeBatches } from '../batches';
import { wholeQuantity } from '../../utils/quantities';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { StockMovement, StockMovementType } from '../../types';
import { getCurrentIsoTimestamp } from '../../utils/dates';

export interface RecordMovementParams {
  variantId: string;
  movementType: StockMovementType;
  quantityDelta: number;
  reason?: string | null;
  saleId?: string | null;
}

export class StockRepository {
  /**
   * Records a stock movement and updates the variant's cached stock balance atomically.
   */
  async recordMovement(params: RecordMovementParams): Promise<StockMovement> {
    wholeQuantity(Math.abs(params.quantityDelta));
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const movement: StockMovement = {
      id: Crypto.randomUUID(),
      variant_id: params.variantId,
      movement_type: params.movementType,
      quantity_delta: params.quantityDelta,
      reason: params.reason ?? null,
      occurred_at: now,
      sale_id: params.saleId ?? null,
    };

    await withInventoryTransaction(db, async () => {
      // Check current variant
      const variant = await db.getFirstAsync<{ stock_quantity: number; status: string; expiration_date: string | null }>(
        'SELECT stock_quantity, status, expiration_date FROM product_variants WHERE id = ?;',
        [params.variantId]
      );

      if (!variant || variant.status !== 'ACTIVE') {
        throw new Error(`Variant ${params.variantId} not found.`);
      }

      const newStock = variant.stock_quantity + params.quantityDelta;

      // Check setting for negative stock
      const setting = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = 'allow_negative_stock';"
      );
      const allowNegative = setting?.value === 'true';

      if (!allowNegative && newStock < 0) {
        throw new Error(`Insufficient stock. Current stock: ${variant.stock_quantity}, requested: ${Math.abs(params.quantityDelta)}`);
      }

      // Insert stock movement record
      await db.runAsync(
        `INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at, sale_id)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          movement.id,
          movement.variant_id,
          movement.movement_type,
          movement.quantity_delta,
          movement.reason,
          movement.occurred_at,
          movement.sale_id,
        ]
      );

      if (params.quantityDelta > 0) await addBatch(db, params.variantId, Math.max(0, newStock) - Math.max(0, variant.stock_quantity), variant.expiration_date, now);
      else await consumeBatches(db, params.variantId, -params.quantityDelta);

      // Update cached balance on variant
      await db.runAsync(
        `UPDATE product_variants
         SET stock_quantity = ?, updated_at = ?
         WHERE id = ?;`,
        [newStock, now, params.variantId]
      );
    });

    return movement;
  }

  private async alignBatches(db: Awaited<ReturnType<typeof getDatabase>>, variantId: string, stock: number, now: string): Promise<void> {
    const row = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_batches WHERE variant_id = ?;', [variantId]);
    const delta = Math.max(0, stock) - (row?.total ?? 0);
    if (delta > 0) await addBatch(db, variantId, delta, null, now);
    else if (delta < 0) await consumeBatches(db, variantId, -delta);
  }

  async getMovementsForVariant(variantId: string, limit = 50): Promise<StockMovement[]> {
    const db = await getDatabase();
    return await db.getAllAsync<StockMovement>(
      `SELECT * FROM stock_movements
       WHERE variant_id = ?
       ORDER BY occurred_at DESC
       LIMIT ?;`,
      [variantId, limit]
    );
  }

  async getAllMovements(limit = 100): Promise<(StockMovement & { product_name: string; variant_label: string })[]> {
    const db = await getDatabase();
    return await db.getAllAsync<StockMovement & { product_name: string; variant_label: string }>(
      `SELECT m.*, p.name as product_name, v.label as variant_label
       FROM stock_movements m
       JOIN product_variants v ON m.variant_id = v.id
       JOIN products p ON v.product_id = p.id
       ORDER BY m.occurred_at DESC
       LIMIT ?;`,
      [limit]
    );
  }

  /**
   * Diagnostic routine: reconciles the stored stock_quantity with the sum of all movement deltas.
   */
  async reconcileVariantStock(variantId: string): Promise<number> {
    const db = await getDatabase();
    let computedBalance = 0;

    await withInventoryTransaction(db, async () => {
      const result = await db.getFirstAsync<{ total: number | null }>(
        'SELECT SUM(quantity_delta) as total FROM stock_movements WHERE variant_id = ?;',
        [variantId]
      );
      computedBalance = result?.total ?? 0;
      const now = getCurrentIsoTimestamp();
      await this.alignBatches(db, variantId, computedBalance, now);

      await db.runAsync(
        `UPDATE product_variants
         SET stock_quantity = ?, updated_at = ?
         WHERE id = ?;`,
        [computedBalance, now, variantId]
      );
    });

    return computedBalance;
  }

  /**
   * Complete inventory reconciliation audit across all variants.
   */
  async reconcileAllVariants(): Promise<{ totalChecked: number; discrepanciesFixed: number }> {
    const db = await getDatabase();
    const variants = await db.getAllAsync<{ id: string; stock_quantity: number }>(
      'SELECT id, stock_quantity FROM product_variants;'
    );

    let discrepanciesFixed = 0;
    const now = getCurrentIsoTimestamp();

    await withInventoryTransaction(db, async () => {
      for (const v of variants) {
        const result = await db.getFirstAsync<{ total: number | null }>(
          'SELECT SUM(quantity_delta) as total FROM stock_movements WHERE variant_id = ?;',
          [v.id]
        );
        const ledgerTotal = result?.total ?? 0;
        if (ledgerTotal !== v.stock_quantity) {
          discrepanciesFixed++;
          await this.alignBatches(db, v.id, ledgerTotal, now);
          await db.runAsync(
            `UPDATE product_variants
             SET stock_quantity = ?, updated_at = ?
             WHERE id = ?;`,
            [ledgerTotal, now, v.id]
          );
        }
      }
    });

    return {
      totalChecked: variants.length,
      discrepanciesFixed,
    };
  }
}

export const stockRepository = new StockRepository();
