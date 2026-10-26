import { withInventoryTransaction } from '../writeTransaction';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { addBatch, consumeBatches, refreshExpiration, StockBatch } from '../batches';
import { normalizeExpirationDate } from '../../utils/expiration';
import { minorAmount, wholeQuantity } from '../../utils/quantities';
import { getCurrentIsoTimestamp } from '../../utils/dates';

export interface ReceivingLine {
  variantId: string;
  quantity: number;
  unitCostMinor: number | null;
  expirationDate: string | null;
}
export interface CustomerBalance { id: string; name: string; balance_minor: number }
export interface ShoppingItem { variant_id: string; quantity: number; checked: number; product_name: string; label: string; unit_label: string }

export class StoreRepository {
  private async write(sql: string, values: (string | number | null)[]): Promise<void> {
    const db = await getDatabase();
    await withInventoryTransaction(db, async () => { await db.runAsync(sql, values); });
  }

  async setting(key: string): Promise<string | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?;', [key]))?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.write('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);', [key, value]);
  }

  async updateVariant(id: string, price: number, cost: number | null, packSize: number): Promise<void> {
    minorAmount(price);
    if (cost !== null) minorAmount(cost, true);
    wholeQuantity(packSize);
    await this.write('UPDATE product_variants SET price_minor = ?, cost_minor = ?, pack_size = ?, updated_at = ? WHERE id = ?;',
      [price, cost, packSize, getCurrentIsoTimestamp(), id]);
  }

  async favorite(id: string, favorite: boolean): Promise<void> {
    await this.write('UPDATE product_variants SET favorite = ? WHERE id = ?;', [favorite ? 1 : 0, id]);
  }

  async batches(variantId: string): Promise<StockBatch[]> {
    const db = await getDatabase();
    return db.getAllAsync<StockBatch>('SELECT * FROM stock_batches WHERE variant_id = ? AND quantity > 0 ORDER BY expiration_date IS NULL, expiration_date, received_at;', [variantId]);
  }

  async dateBatch(id: string, date: string | null): Promise<void> {
    const normalized = normalizeExpirationDate(date);
    const db = await getDatabase();
    await withInventoryTransaction(db, async () => {
      const batch = await db.getFirstAsync<StockBatch>('SELECT * FROM stock_batches WHERE id = ?;', [id]);
      if (!batch) throw new Error('Batch no longer exists.');
      await db.runAsync('UPDATE stock_batches SET expiration_date = ? WHERE id = ?;', [normalized, id]);
      await refreshExpiration(db, batch.variant_id);
    });
  }

  async countStock(lines: { variantId: string; counted: number; expected: number }[]): Promise<void> {
    if (!lines.length) throw new Error('Enter at least one count.');
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    await withInventoryTransaction(db, async () => {
      for (const line of lines) {
        wholeQuantity(line.counted, true);
        const current = await db.getFirstAsync<{ stock_quantity: number }>('SELECT stock_quantity FROM product_variants WHERE id = ?;', [line.variantId]);
        if (!current || current.stock_quantity !== line.expected) throw new Error('Stock changed while counting. Refresh and review your counts.');
        const delta = line.counted - current.stock_quantity;
        if (!delta) continue;
        await db.runAsync('INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at) VALUES (?, ?, ?, ?, ?, ?);',
          [Crypto.randomUUID(), line.variantId, 'ADJUSTMENT', delta, 'Physical stock count correction', now]);
        await db.runAsync('UPDATE product_variants SET stock_quantity = ?, updated_at = ? WHERE id = ?;', [line.counted, now, line.variantId]);
        if (delta > 0) await addBatch(db, line.variantId, Math.max(0, line.counted) - Math.max(0, current.stock_quantity), null, now);
        else await consumeBatches(db, line.variantId, -delta);
      }
    });
  }

  async receive(supplier: string, lines: ReceivingLine[]): Promise<void> {
    if (!lines.length) throw new Error('Add at least one delivery item.');
    const prepared = lines.map(line => ({ ...line, quantity: wholeQuantity(line.quantity),
      unitCostMinor: line.unitCostMinor === null ? null : minorAmount(line.unitCostMinor, true), expirationDate: normalizeExpirationDate(line.expirationDate) }));
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const id = Crypto.randomUUID();
    await withInventoryTransaction(db, async () => {
      await db.runAsync('INSERT INTO deliveries (id, supplier, total_cost_minor, received_at) VALUES (?, ?, ?, ?);',
        [id, supplier.trim() || null, prepared.reduce((sum, line) => sum + (line.unitCostMinor ?? 0) * line.quantity, 0), now]);
      for (const line of prepared) {
        const variant = await db.getFirstAsync<{ status: string; stock_quantity: number }>(`SELECT v.status, v.stock_quantity FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND p.status = 'ACTIVE';`, [line.variantId]);
        if (!variant || variant.status !== 'ACTIVE') throw new Error('A delivery item is no longer available.');
        await db.runAsync('UPDATE product_variants SET stock_quantity = stock_quantity + ?, cost_minor = COALESCE(?, cost_minor), updated_at = ? WHERE id = ?;', [line.quantity, line.unitCostMinor, now, line.variantId]);
        await db.runAsync('INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at) VALUES (?, ?, ?, ?, ?, ?);',
          [Crypto.randomUUID(), line.variantId, 'RESTOCK', line.quantity, supplier.trim() ? `Supplier delivery: ${supplier.trim()}` : 'Supplier delivery', now]);
        const batchId = await addBatch(db, line.variantId, Math.max(0, variant.stock_quantity + line.quantity) - Math.max(0, variant.stock_quantity), line.expirationDate, now);
        await db.runAsync('INSERT INTO delivery_items (id, delivery_id, variant_id, quantity, unit_cost_minor, batch_id) VALUES (?, ?, ?, ?, ?, ?);',
          [Crypto.randomUUID(), id, line.variantId, line.quantity, line.unitCostMinor, batchId]);
      }
    });
  }

  async customers(): Promise<CustomerBalance[]> {
    const db = await getDatabase();
    return db.getAllAsync<CustomerBalance>(`SELECT c.id, c.name, COALESCE(SUM(e.amount_minor), 0) AS balance_minor
      FROM customers c LEFT JOIN credit_entries e ON e.customer_id = c.id GROUP BY c.id ORDER BY c.name;`);
  }

  async addCustomer(name: string): Promise<void> {
    if (!name.trim()) throw new Error('Enter a customer name.');
    await this.write('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?);', [Crypto.randomUUID(), name.trim(), getCurrentIsoTimestamp()]);
  }

  async creditHistory(customerId: string): Promise<{ id: string; amount_minor: number; payment_method: string; occurred_at: string; note: string }[]> {
    const db = await getDatabase();
    return db.getAllAsync('SELECT * FROM credit_entries WHERE customer_id = ? ORDER BY occurred_at DESC;', [customerId]);
  }

  async repay(customerId: string, amount: number, method: 'CASH' | 'E-WALLET'): Promise<void> {
    minorAmount(amount);
    const db = await getDatabase();
    await withInventoryTransaction(db, async () => {
      const balance = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_minor), 0) AS total FROM credit_entries WHERE customer_id = ?;', [customerId]);
      if (amount > (balance?.total ?? 0)) throw new Error('Payment exceeds the remaining balance.');
      await db.runAsync('INSERT INTO credit_entries (id, customer_id, amount_minor, payment_method, note, occurred_at) VALUES (?, ?, ?, ?, ?, ?);',
        [Crypto.randomUUID(), customerId, -amount, method, 'Customer payment', getCurrentIsoTimestamp()]);
    });
  }

  async shopping(): Promise<ShoppingItem[]> {
    const db = await getDatabase();
    return db.getAllAsync(`SELECT l.*, p.name AS product_name, v.label, v.unit_label FROM shopping_list l
      JOIN product_variants v ON v.id = l.variant_id JOIN products p ON p.id = v.product_id ORDER BY l.checked, p.name;`);
  }

  async shopItem(variantId: string, quantity: number, checked = false): Promise<void> {
    wholeQuantity(quantity);
    await this.write('INSERT OR REPLACE INTO shopping_list (variant_id, quantity, checked) VALUES (?, ?, ?);', [variantId, quantity, checked ? 1 : 0]);
  }

  async removeShopping(variantId: string): Promise<void> {
    await this.write('DELETE FROM shopping_list WHERE variant_id = ?;', [variantId]);
  }

  async expense(description: string, amount: number, method: 'CASH' | 'E-WALLET', kind: 'OPERATING' | 'STOCK_PURCHASE' | 'WITHDRAWAL' = 'OPERATING'): Promise<void> {
    if (!description.trim()) throw new Error('Describe this expense.');
    minorAmount(amount);
    await this.write('INSERT INTO expenses (id, description, amount_minor, payment_method, occurred_at, kind) VALUES (?, ?, ?, ?, ?, ?);',
      [Crypto.randomUUID(), description.trim(), amount, method, getCurrentIsoTimestamp(), kind]);
  }

  async closing(start: string, end: string): Promise<{ cash: number; wallet: number; credit: number; payments: number; expenses: number; cashExpenses: number; cashPayments: number; other: number }> {
    const db = await getDatabase();
    const sales = await db.getFirstAsync<{ cash: number; wallet: number; credit: number; other: number }>(`SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_minor ELSE 0 END),0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method = 'E-WALLET' THEN total_minor ELSE 0 END),0) AS wallet,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total_minor ELSE 0 END),0) AS credit,
      COALESCE(SUM(CASE WHEN payment_method IN ('CARD','OTHER') THEN total_minor ELSE 0 END),0) AS other
      FROM sales WHERE status = 'COMPLETED' AND sold_at >= ? AND sold_at < ?;`, [start, end]);
    const payments = await db.getFirstAsync<{ payments: number; cashPayments: number }>(`SELECT COALESCE(-SUM(amount_minor),0) AS payments,
      COALESCE(-SUM(CASE WHEN payment_method = 'CASH' THEN amount_minor ELSE 0 END),0) AS cashPayments
      FROM credit_entries WHERE amount_minor < 0 AND sale_id IS NULL AND occurred_at >= ? AND occurred_at < ?;`, [start, end]);
    const expenses = await db.getFirstAsync<{ expenses: number; cashExpenses: number }>(`SELECT COALESCE(SUM(CASE WHEN kind = 'OPERATING' THEN amount_minor ELSE 0 END),0) AS expenses,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount_minor ELSE 0 END),0) AS cashExpenses
      FROM expenses WHERE occurred_at >= ? AND occurred_at < ?;`, [start, end]);
    return { cash: 0, wallet: 0, credit: 0, other: 0, payments: 0, cashPayments: 0, expenses: 0, cashExpenses: 0, ...sales, ...payments, ...expenses };
  }
}

export const storeRepository = new StoreRepository();
