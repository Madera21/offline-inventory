import { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { normalizeExpirationDate } from '../utils/expiration';

export interface StockBatch {
  id: string;
  variant_id: string;
  quantity: number;
  expiration_date: string | null;
  received_at: string;
}

export async function refreshExpiration(db: SQLiteDatabase, variantId: string): Promise<void> {
  await db.runAsync(`UPDATE product_variants SET expiration_date = (
    SELECT MIN(expiration_date) FROM stock_batches WHERE variant_id = ? AND quantity > 0
  ) WHERE id = ?;`, [variantId, variantId]);
}

/** Called inside the same transaction as the quantity and movement writes. */
export async function addBatch(db: SQLiteDatabase, variantId: string, quantity: number, date: string | null, now: string): Promise<string> {
  const id = Crypto.randomUUID();
  await db.runAsync('INSERT INTO stock_batches (id, variant_id, quantity, expiration_date, received_at) VALUES (?, ?, ?, ?, ?);',
    [id, variantId, quantity, normalizeExpirationDate(date), now]);
  await refreshExpiration(db, variantId);
  return id;
}

/** Earliest expiration first; undated stock is used last. */
export async function consumeBatches(db: SQLiteDatabase, variantId: string, quantity: number, saleItemId?: string): Promise<void> {
  const batches = await db.getAllAsync<StockBatch>(`SELECT * FROM stock_batches WHERE variant_id = ? AND quantity > 0
    ORDER BY expiration_date IS NULL, expiration_date, received_at, id;`, [variantId]);
  let remaining = quantity;
  for (const batch of batches) {
    const taken = Math.min(remaining, batch.quantity);
    if (!taken) break;
    await db.runAsync('UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?;', [taken, batch.id]);
    if (saleItemId) {
      await db.runAsync('INSERT INTO sale_batch_allocations (sale_item_id, batch_id, quantity) VALUES (?, ?, ?);', [saleItemId, batch.id, taken]);
    }
    remaining -= taken;
  }
  // Negative inventory is supported by the existing optional setting; it has no physical batches.
  await refreshExpiration(db, variantId);
}

export async function restoreSaleBatches(db: SQLiteDatabase, saleItemId: string, variantId: string, quantity: number, now: string): Promise<void> {
  const allocations = await db.getAllAsync<{ batch_id: string; quantity: number }>(
    'SELECT batch_id, quantity FROM sale_batch_allocations WHERE sale_item_id = ?;', [saleItemId]);
  let restored = 0;
  for (const allocation of allocations) {
    const returned = Math.min(quantity - restored, allocation.quantity);
    if (returned <= 0) break;
    await db.runAsync('UPDATE stock_batches SET quantity = quantity + ? WHERE id = ?;', [returned, allocation.batch_id]);
    restored += returned;
  }
  if (restored < quantity) await addBatch(db, variantId, quantity - restored, null, now);
  await refreshExpiration(db, variantId);
}

/** A new variant, its opening ledger entry, and its first batch share one transaction. */
export async function openingBatch(db: SQLiteDatabase, variantId: string, quantity: number, date: string | null, now: string): Promise<void> {
  if (!quantity) return;
  await db.runAsync('INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at) VALUES (?, ?, ?, ?, ?, ?);',
    [Crypto.randomUUID(), variantId, 'OPENING_STOCK', quantity, 'Initial stock on creation', now]);
  await db.runAsync('UPDATE product_variants SET stock_quantity = ? WHERE id = ?;', [quantity, variantId]);
  await addBatch(db, variantId, quantity, date, now);
}
