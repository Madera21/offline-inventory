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

    await db.withTransactionAsync(async () => {
      // Check current variant
      const variant = await db.getFirstAsync<{ stock_quantity: number; status: string }>(
        'SELECT stock_quantity, status FROM product_variants WHERE id = ?;',
        [params.variantId]
      );

      if (!variant) {
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

    await db.withTransactionAsync(async () => {
      const result = await db.getFirstAsync<{ total: number | null }>(
        'SELECT SUM(quantity_delta) as total FROM stock_movements WHERE variant_id = ?;',
        [variantId]
      );
      computedBalance = result?.total ?? 0;
      const now = getCurrentIsoTimestamp();

      await db.runAsync(
        `UPDATE product_variants
         SET stock_quantity = ?, updated_at = ?
         WHERE id = ?;`,
        [computedBalance, now, variantId]
      );
    });

    return computedBalance;
  }
}

export const stockRepository = new StockRepository();
