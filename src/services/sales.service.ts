import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/database';
import { Sale, SaleItem, PaymentMethod } from '../types';
import { getCurrentIsoTimestamp } from '../utils/dates';
import { CartItem } from '../store/cart.store';

export interface CommitSaleInput {
  items: CartItem[];
  discountMinor: number;
  paymentMethod: PaymentMethod;
}

export interface SaleWithDetails extends Sale {
  items: (SaleItem & {
    product_name: string;
    variant_label: string;
    unit_label: string;
  })[];
}

export class SalesService {
  /**
   * Commits a sale atomically in a SQLite transaction.
   * Decreases stock for all line items and records snapshots.
   */
  async commitSale(input: CommitSaleInput): Promise<SaleWithDetails> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot commit an empty sale.');
    }

    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const saleId = Crypto.randomUUID();

    // Generate readable receipt number: REC-YYYYMMDD-HHMMSS-XXXX
    const datePart = now.slice(0, 10).replace(/-/g, '');
    const randomHex = Crypto.randomUUID().slice(0, 4).toUpperCase();
    const receiptNumber = `REC-${datePart}-${randomHex}`;

    let subtotalMinor = 0;
    const itemsToInsert: (SaleItem & {
      product_name: string;
      variant_label: string;
      unit_label: string;
    })[] = [];

    await db.withTransactionAsync(async () => {
      // 1. Check setting for negative stock
      const setting = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = 'allow_negative_stock';"
      );
      const allowNegative = setting?.value === 'true';

      // 2. Reload each variant and verify stock
      for (const cartItem of input.items) {
        const variant = await db.getFirstAsync<{
          id: string;
          label: string;
          stock_quantity: number;
          status: string;
          price_minor: number;
          cost_minor: number | null;
          unit_label: string;
          product_name: string;
        }>(
          `SELECT v.*, p.name as product_name 
           FROM product_variants v
           JOIN products p ON v.product_id = p.id
           WHERE v.id = ?;`,
          [cartItem.variant_id]
        );

        if (!variant || variant.status !== 'ACTIVE') {
          throw new Error(`Variant "${cartItem.product_name} - ${cartItem.variant_label}" is no longer available.`);
        }

        if (!allowNegative && variant.stock_quantity < cartItem.quantity) {
          throw new Error(
            `Insufficient stock for "${variant.product_name} (${variant.label})". Requested: ${cartItem.quantity}, Available: ${variant.stock_quantity}`
          );
        }

        const lineTotalMinor = variant.price_minor * cartItem.quantity;
        subtotalMinor += lineTotalMinor;

        itemsToInsert.push({
          id: Crypto.randomUUID(),
          sale_id: saleId,
          variant_id: variant.id,
          quantity: cartItem.quantity,
          unit_price_minor: variant.price_minor,
          unit_cost_minor: variant.cost_minor,
          line_total_minor: lineTotalMinor,
          product_name: variant.product_name,
          variant_label: variant.label,
          unit_label: variant.unit_label,
        });
      }

      const discountMinor = Math.min(input.discountMinor || 0, subtotalMinor);
      const totalMinor = Math.max(0, subtotalMinor - discountMinor);

      // 3. Insert sales header record
      await db.runAsync(
        `INSERT INTO sales (id, receipt_number, sold_at, subtotal_minor, discount_minor, total_minor, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          saleId,
          receiptNumber,
          now,
          subtotalMinor,
          discountMinor,
          totalMinor,
          input.paymentMethod,
          'COMPLETED',
        ]
      );

      // 4. Insert each sale item, stock movement, and update variant balance
      for (const item of itemsToInsert) {
        await db.runAsync(
          `INSERT INTO sale_items (id, sale_id, variant_id, quantity, unit_price_minor, unit_cost_minor, line_total_minor)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            item.id,
            item.sale_id,
            item.variant_id,
            item.quantity,
            item.unit_price_minor,
            item.unit_cost_minor,
            item.line_total_minor,
          ]
        );

        const movementId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at, sale_id)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            movementId,
            item.variant_id,
            'SALE',
            -item.quantity,
            `Sale ${receiptNumber}`,
            now,
            saleId,
          ]
        );

        await db.runAsync(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity - ?, updated_at = ?
           WHERE id = ?;`,
          [item.quantity, now, item.variant_id]
        );
      }
    });

    const discountMinor = Math.min(input.discountMinor || 0, subtotalMinor);
    const totalMinor = Math.max(0, subtotalMinor - discountMinor);

    return {
      id: saleId,
      receipt_number: receiptNumber,
      sold_at: now,
      subtotal_minor: subtotalMinor,
      discount_minor: discountMinor,
      total_minor: totalMinor,
      payment_method: input.paymentMethod,
      status: 'COMPLETED',
      items: itemsToInsert,
    };
  }

  async getSaleWithDetails(saleId: string): Promise<SaleWithDetails | null> {
    const db = await getDatabase();
    const sale = await db.getFirstAsync<Sale>(
      'SELECT * FROM sales WHERE id = ?;',
      [saleId]
    );

    if (!sale) return null;

    const items = await db.getAllAsync<SaleItem & {
      product_name: string;
      variant_label: string;
      unit_label: string;
    }>(
      `SELECT si.*, p.name as product_name, v.label as variant_label, v.unit_label
       FROM sale_items si
       JOIN product_variants v ON si.variant_id = v.id
       JOIN products p ON v.product_id = p.id
       WHERE si.sale_id = ?;`,
      [saleId]
    );

    return {
      ...sale,
      items,
    };
  }

  async getAllSales(limit = 100): Promise<Sale[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Sale>(
      'SELECT * FROM sales ORDER BY sold_at DESC LIMIT ?;',
      [limit]
    );
  }

  /**
   * Voids an existing sale, creating explicit VOID_REVERSAL movements and restoring stock.
   */
  async voidSale(saleId: string, reason: string): Promise<void> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();

    await db.withTransactionAsync(async () => {
      const sale = await db.getFirstAsync<Sale>(
        'SELECT * FROM sales WHERE id = ?;',
        [saleId]
      );

      if (!sale) {
        throw new Error('Sale not found.');
      }

      if (sale.status === 'VOIDED') {
        throw new Error('This sale has already been voided.');
      }

      const items = await db.getAllAsync<SaleItem>(
        'SELECT * FROM sale_items WHERE sale_id = ?;',
        [saleId]
      );

      // 1. Mark sale as voided
      await db.runAsync(
        "UPDATE sales SET status = 'VOIDED' WHERE id = ?;",
        [saleId]
      );

      // 2. Reverse stock impact for each item
      for (const item of items) {
        const movementId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at, sale_id)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            movementId,
            item.variant_id,
            'VOID_REVERSAL',
            item.quantity,
            `Void Sale ${sale.receipt_number}: ${reason || 'Customer cancellation'}`,
            now,
            saleId,
          ]
        );

        await db.runAsync(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity + ?, updated_at = ?
           WHERE id = ?;`,
          [item.quantity, now, item.variant_id]
        );
      }
    });
  }
}

export const salesService = new SalesService();
