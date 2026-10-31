jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///app/', writeAsStringAsync: jest.fn(), EncodingType: { UTF8: 'utf8' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('../src/services/image.service', () => ({ ensureImagesDirectoryExists: jest.fn() }));

import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../src/db/database';
import { runMigrations } from '../src/db/migrations';
import { MIGRATION_V1, MIGRATION_V2, MIGRATION_V3, MIGRATION_V4 } from '../src/db/schema';
import { productsRepository } from '../src/db/repositories/products.repository';
import { stockRepository } from '../src/db/repositories/stock.repository';
import { storeRepository } from '../src/db/repositories/store.repository';
import { reportsRepository } from '../src/db/repositories/reports.repository';
import { salesService } from '../src/services/sales.service';
import { backupService } from '../src/services/backup.service';
import { matchesExpirationFilter } from '../src/utils/expiration';
import { TestSqlite } from './helpers/sqlite';
import { getDayStartAndEndIso } from '../src/utils/dates';

jest.setTimeout(30000);
let db: TestSqlite;
beforeEach(async () => {
  db = new TestSqlite();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await runMigrations(db as any);
});
afterEach(() => db.close());
async function product(name = 'Milk', stock = 10, expiration = '2026-11-01') {
  return productsRepository.create({ name, price_minor: 1000, cost_minor: 600, opening_stock: stock, expiration_date: expiration });
}
function cart(p: Awaited<ReturnType<typeof product>>, quantity = 1) {
  const v = p.variants[0];
  return { variant_id: v.id, product_id: p.id, product_name: p.name, variant_label: v.label,
    unit_label: v.unit_label, unit_price_minor: v.price_minor, unit_cost_minor: v.cost_minor, max_available_stock: 100, quantity };
}
async function balance(id: string) { return (await db.getFirstAsync('SELECT stock_quantity FROM product_variants WHERE id = ?;', [id])).stock_quantity; }
async function batchTotal(id: string) { return (await db.getFirstAsync('SELECT COALESCE(SUM(quantity),0) AS total FROM stock_batches WHERE variant_id = ?;', [id])).total; }

test('selected-day reports include both day boundaries and exclude adjacent days and voided sales', async () => {
  const p = await product();
  const range = getDayStartAndEndIso(new Date(2026, 9, 15));
  const timestamps = [new Date(Date.parse(range.start) - 1).toISOString(), range.start, range.end,
    new Date(Date.parse(range.end) + 1).toISOString(), range.start];
  for (const [index, timestamp] of timestamps.entries()) {
    const sale = await salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CASH' });
    await db.runAsync('UPDATE sales SET sold_at = ? WHERE id = ?;', [timestamp, sale.id]);
    if (index === 4) await salesService.voidSale(sale.id, 'Cancelled');
  }
  expect(await reportsRepository.getSalesReport(range.start, range.end)).toMatchObject({ transactionCount: 2, unitsSold: 2, totalRevenueMinor: 2000 });
  expect(await reportsRepository.getBestSellers(5, range.start, false, range.end)).toMatchObject([{ total_quantity: 2, total_revenue_minor: 2000 }]);
});

test('stock fractions retain the stocked total through sales, voids, damage, returns, and deliveries', async () => {
  const p = await product();
  const variantId = p.variants[0].id;
  const read = () => productsRepository.getByIdWithDetails(p.id);
  expect(await read()).toMatchObject({ total_stock: 10, total_stocked: 10 });
  const sale = await salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CASH' });
  expect(await read()).toMatchObject({ total_stock: 9, total_stocked: 10 });
  expect((await productsRepository.getAllWithDetails())[0].variants[0]).toMatchObject({ stock_quantity: 9, total_stocked: 10 });
  await salesService.voidSale(sale.id, 'Sample cancelled');
  expect(await read()).toMatchObject({ total_stock: 10, total_stocked: 10 });
  await stockRepository.recordMovement({ variantId, movementType: 'DAMAGE', quantityDelta: -2, reason: 'Broken' });
  await stockRepository.recordMovement({ variantId, movementType: 'CUSTOMER_RETURN', quantityDelta: 1, reason: 'Returned' });
  expect(await read()).toMatchObject({ total_stock: 9, total_stocked: 10 });
  await storeRepository.receive('Supplier', [{ variantId, quantity: 5, unitCostMinor: 500, expirationDate: null }]);
  expect(await read()).toMatchObject({ total_stock: 14, total_stocked: 15 });
});

test('saved products can replace, frame, remove, and add photos without changing stock', async () => {
  const p = await productsRepository.create({ name: 'Milk', price_minor: 1000, opening_stock: 10, image_relative_paths: ['images/old.jpg'] });
  const imageId = p.images[0].id;
  await productsRepository.update(p.id, { name: 'Fresh milk', primary_image: { relative_path: 'images/new.jpg', frame_json: '{"zoom":2,"x":0,"y":0}' } });
  const edited = await productsRepository.getByIdWithDetails(p.id);
  expect(edited).toMatchObject({ name: 'Fresh milk', total_stock: 10, images: [{ id: imageId, relative_path: 'images/new.jpg', frame_json: '{"zoom":2,"x":0,"y":0}' }] });
  await productsRepository.update(p.id, { primary_image: null });
  expect((await productsRepository.getByIdWithDetails(p.id))!.images).toEqual([]);
  await productsRepository.update(p.id, { primary_image: { relative_path: 'images/added.jpg', frame_json: null } });
  expect((await productsRepository.getByIdWithDetails(p.id))!.images[0].relative_path).toBe('images/added.jpg');
  expect(await balance(p.variants[0].id)).toBe(10);
});

test('photo write failures roll back product information and preserve the original image', async () => {
  const p = await productsRepository.create({ name: 'Milk', price_minor: 1000, image_relative_paths: ['images/old.jpg'] });
  await db.execAsync("CREATE TRIGGER reject_photo BEFORE UPDATE OF relative_path ON product_images BEGIN SELECT RAISE(ABORT, 'Photo write failed'); END;");
  await expect(productsRepository.update(p.id, { name: 'Changed', primary_image: { relative_path: 'images/new.jpg', frame_json: null } })).rejects.toThrow('Photo write failed');
  expect(await productsRepository.getByIdWithDetails(p.id)).toMatchObject({ name: 'Milk', images: [{ relative_path: 'images/old.jpg' }] });
});

test('upgrades V4 records and reruns without losing stock, images, sales, settings, or history', async () => {
  db.close(); db = new TestSqlite(); (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(MIGRATION_V1 + MIGRATION_V2 + MIGRATION_V3 + MIGRATION_V4);
  await db.execAsync("INSERT INTO schema_migrations VALUES (1,'now'),(2,'now'),(3,'now'),(4,'now'); INSERT INTO app_settings VALUES ('appearance','dark');");
  await db.execAsync("INSERT INTO products VALUES ('p','Milk',NULL,NULL,NULL,NULL,'ACTIVE','now','now'); INSERT INTO product_variants (id, product_id, label, stock_quantity, status, created_at, updated_at, expiration_date) VALUES ('v','p','Standard',7,'ACTIVE','now','now','2026-11-01'); INSERT INTO product_images VALUES ('image','p','images/test.jpg',0,'now','{}'); INSERT INTO sales VALUES ('sale','REC-OLD','now',100,0,100,'CASH','COMPLETED'); INSERT INTO stock_movements VALUES ('move','v','OPENING_STOCK',7,NULL,'now',NULL);");
  await runMigrations(db as any); await runMigrations(db as any);
  expect(await balance('v')).toBe(7); expect(await batchTotal('v')).toBe(7);
  expect(await storeRepository.setting('appearance')).toBe('dark');
  expect((await db.getAllAsync('SELECT * FROM sales;'))).toHaveLength(1);
  expect((await db.getAllAsync('SELECT * FROM product_images;'))).toHaveLength(1);
  expect((await db.getAllAsync('SELECT * FROM stock_movements;'))).toHaveLength(1);
  expect((await db.getFirstAsync('SELECT pack_size, favorite FROM product_variants;'))).toEqual({ pack_size: 1, favorite: 0 });
  expect((await db.getAllAsync('PRAGMA foreign_key_check;'))).toEqual([]);
});

test('reports each sale once, subtracts discounts, and excludes voided sales', async () => {
  const a = await product(); const b = await product('Bread');
  const sale = await salesService.commitSale({ items: [cart(a, 2), cart(b)], discountMinor: 300, paymentMethod: 'CASH' });
  const report = await reportsRepository.getSalesReport();
  expect(report).toMatchObject({ totalRevenueMinor: 2700, transactionCount: 1, unitsSold: 3, estimatedGrossProfitMinor: 900 });
  await salesService.voidSale(sale.id, 'Cancelled');
  expect((await reportsRepository.getSalesReport()).totalRevenueMinor).toBe(0);
});

test('receives multi-item deliveries, converts packs to shared pieces, and preserves old sale price/cost snapshots', async () => {
  const p = await product(); const q = await product('Bread'); const v = p.variants[0].id;
  const sale = await salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CASH' });
  await storeRepository.updateVariant(v, 1200, 700, 6); await storeRepository.favorite(v, true);
  await storeRepository.receive('My supplier', [{ variantId: v, quantity: 2 * 6, unitCostMinor: 650, expirationDate: '2026-12-01' }, { variantId: q.variants[0].id, quantity: 4, unitCostMinor: 500, expirationDate: null }]);
  expect(await balance(v)).toBe(21); expect(await batchTotal(v)).toBe(21);
  expect((await salesService.getSaleWithDetails(sale.id))?.items[0]).toMatchObject({ unit_price_minor: 1000, unit_cost_minor: 600 });
  expect((await productsRepository.getByIdWithDetails(p.id))?.variants[0]).toMatchObject({ pack_size: 6, favorite: 1, cost_minor: 650, price_minor: 1200 });
  expect((await db.getFirstAsync('SELECT total_cost_minor FROM deliveries;')).total_cost_minor).toBe(9800);
});

test('delivery failure rolls back every item, cost update, batch, and receipt', async () => {
  const p = await product(); const v = p.variants[0].id;
  await expect(storeRepository.receive('Supplier', [{ variantId: v, quantity: 5, unitCostMinor: 900, expirationDate: null }, { variantId: 'missing', quantity: 1, unitCostMinor: null, expirationDate: null }])).rejects.toThrow();
  expect(await balance(v)).toBe(10); expect(await batchTotal(v)).toBe(10);
  expect((await db.getFirstAsync('SELECT cost_minor FROM product_variants WHERE id = ?;', [v])).cost_minor).toBe(600);
  expect(await db.getAllAsync('SELECT * FROM deliveries;')).toEqual([]);
});

test('stock counts record positive and negative differences, accept zero, and roll back stale sessions', async () => {
  const p = await product(); const q = await product('Bread'); const v = p.variants[0].id; const w = q.variants[0].id;
  await storeRepository.countStock([{ variantId: v, counted: 7, expected: 10 }]);
  expect(await balance(v)).toBe(7); expect(await batchTotal(v)).toBe(7);
  await expect(storeRepository.countStock([{ variantId: v, counted: 9, expected: 7 }, { variantId: w, counted: 4, expected: 8 }])).rejects.toThrow('Stock changed');
  expect(await balance(v)).toBe(7);
  await storeRepository.countStock([{ variantId: v, counted: 0, expected: 7 }]);
  expect(await batchTotal(v)).toBe(0);
  await storeRepository.countStock([{ variantId: v, counted: 4, expected: 0 }]);
  expect(await batchTotal(v)).toBe(4);
});

test('sales consume earliest batches and void restores the same expiration allocations', async () => {
  const p = await product('Milk', 5, '2026-12-01'); const v = p.variants[0].id;
  await storeRepository.receive('', [{ variantId: v, quantity: 3, unitCostMinor: null, expirationDate: '2026-11-01' }]);
  const sale = await salesService.commitSale({ items: [cart(p, 4)], discountMinor: 0, paymentMethod: 'CASH' });
  const batches = await storeRepository.batches(v);
  expect(batches).toHaveLength(1); expect(batches[0]).toMatchObject({ quantity: 4, expiration_date: '2026-12-01' });
  await salesService.voidSale(sale.id, 'Wrong sale');
  expect((await storeRepository.batches(v)).map(b => [b.expiration_date, b.quantity])).toEqual([['2026-11-01', 3], ['2026-12-01', 5]]);
  expect(await balance(v)).toBe(8); expect(await batchTotal(v)).toBe(8);
});

test('multiple dates match both expiration filters without overwriting batches', async () => {
  const p = await product('Milk', 2, '2026-10-20'); const v = p.variants[0].id;
  await storeRepository.receive('', [{ variantId: v, quantity: 3, unitCostMinor: null, expirationDate: '2026-11-01' }]);
  const variant = (await productsRepository.getByIdWithDetails(p.id))!.variants[0];
  const today = new Date(2026, 9, 24);
  expect(matchesExpirationFilter(variant, 'expired', today)).toBe(true);
  expect(matchesExpirationFilter(variant, 'soon', today)).toBe(true);
  await expect(productsRepository.updateVariantExpiration(v, '2027-01-01')).rejects.toThrow('several batches');
  const batch = (await storeRepository.batches(v))[0]; await storeRepository.dateBatch(batch.id, null);
  expect((await storeRepository.batches(v)).find(b => b.id === batch.id)?.expiration_date).toBeNull();
});

test('utang, partial repayments, expenses, and closing keep receivables separate from cash', async () => {
  const p = await product(); await storeRepository.addCustomer('Ana'); const customer = (await storeRepository.customers())[0];
  const sale = await salesService.commitSale({ items: [cart(p, 3)], discountMinor: 0, paymentMethod: 'CREDIT', customerId: customer.id });
  await storeRepository.repay(customer.id, 1000, 'CASH'); await storeRepository.expense('Electricity', 200, 'CASH');
  await storeRepository.expense('Stock purchase', 400, 'CASH', 'STOCK_PURCHASE');
  await storeRepository.expense('Wallet expense', 100, 'E-WALLET');
  expect((await storeRepository.customers())[0].balance_minor).toBe(2000);
  await expect(storeRepository.repay(customer.id, 2001, 'CASH')).rejects.toThrow('exceeds');
  const closing = await storeRepository.closing('2000-01-01', '2099-01-01');
  expect(closing).toMatchObject({ cash: 0, credit: 3000, payments: 1000, cashPayments: 1000, expenses: 300, cashExpenses: 600 });
  await expect(salesService.voidSale(sale.id, 'Refund')).rejects.toThrow('repaid');
  expect(await balance(p.variants[0].id)).toBe(7);
  expect((await storeRepository.creditHistory(customer.id))).toHaveLength(2);
});

test('cash, duplicate item, fractional quantity, and invalid delivery inputs fail without stock changes', async () => {
  const p = await product();
  await expect(salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CASH', cashReceivedMinor: 999 })).rejects.toThrow('Cash received');
  await expect(salesService.commitSale({ items: [cart(p), cart(p)], discountMinor: 0, paymentMethod: 'CASH' })).rejects.toThrow('Duplicate');
  await expect(salesService.commitSale({ items: [cart(p, 1.5)], discountMinor: 0, paymentMethod: 'CASH' })).rejects.toThrow('quantity');
  await expect(storeRepository.receive('', [{ variantId: p.variants[0].id, quantity: 0, unitCostMinor: null, expirationDate: null }])).rejects.toThrow();
  expect(await balance(p.variants[0].id)).toBe(10);
  expect(await db.getAllAsync('SELECT * FROM sales;')).toEqual([]);
});

test('shopping list persists quantities and checkmarks without changing stock', async () => {
  const p = await product(); const v = p.variants[0].id;
  await storeRepository.shopItem(v, 12); await storeRepository.shopItem(v, 24, true);
  expect((await storeRepository.shopping())[0]).toMatchObject({ variant_id: v, quantity: 24, checked: 1 });
  expect(await balance(v)).toBe(10); await storeRepository.removeShopping(v);
  expect(await storeRepository.shopping()).toEqual([]);
});

test('V5 backup round-trips batches, credit, deliveries, expenses, preferences, and favorites', async () => {
  const p = await product(); const v = p.variants[0].id;
  await storeRepository.favorite(v, true); await storeRepository.setSetting('language', 'fil'); await storeRepository.shopItem(v, 5);
  await storeRepository.addCustomer('Ana'); const customer = (await storeRepository.customers())[0];
  await salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CREDIT', customerId: customer.id });
  await storeRepository.receive('Supplier', [{ variantId: v, quantity: 3, unitCostMinor: 700, expirationDate: '2027-01-01' }]);
  await storeRepository.expense('Lights', 100, 'CASH');
  await backupService.createFullBackup();
  const calls = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls; const payload = calls[calls.length - 1][1];
  await storeRepository.countStock([{ variantId: v, expected: 12, counted: 0 }]);
  await backupService.restoreBackup(payload);
  expect(await balance(v)).toBe(12); expect(await batchTotal(v)).toBe(12);
  expect((await storeRepository.customers())[0].balance_minor).toBe(1000);
  expect(await storeRepository.setting('language')).toBe('fil');
  expect((await storeRepository.shopping())[0].quantity).toBe(5);
  expect((await db.getAllAsync('PRAGMA foreign_key_check;'))).toEqual([]);
});

test('V1-V4 backup imports backfill batches and keep totals; future backups leave records untouched', async () => {
  const p = await product(); const v = p.variants[0].id;
  await backupService.createFullBackup();
  const calls = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls;
  const payload = JSON.parse(calls[calls.length - 1][1]); payload.manifest.schema_version = 4;
  for (const key of ['customers','stock_batches','deliveries','delivery_items','credit_entries','expenses','shopping_list','sale_batch_allocations']) delete payload.data[key];
  await backupService.restoreBackup(JSON.stringify(payload));
  expect(await batchTotal(v)).toBe(10);
  payload.manifest.schema_version = 999;
  await expect(backupService.restoreBackup(JSON.stringify(payload))).rejects.toThrow('newer');
  expect(await balance(v)).toBe(10);
});

test.each([1, 2, 3])('upgrade from schema V%s keeps the existing catalog and seeds undated batches', async version => {
  db.close(); db = new TestSqlite(); (getDatabase as jest.Mock).mockResolvedValue(db);
  const migrations = [MIGRATION_V1, MIGRATION_V2, MIGRATION_V3];
  for (let index = 0; index < version; index++) {
    await db.execAsync(migrations[index]);
    await db.runAsync('INSERT INTO schema_migrations VALUES (?, ?);', [index + 1, 'now']);
  }
  await db.execAsync("INSERT INTO products VALUES ('p','Old product',NULL,NULL,NULL,NULL,'ACTIVE','now','now'); INSERT INTO product_variants (id, product_id, label, stock_quantity, status, created_at, updated_at) VALUES ('v','p','Standard',9,'ACTIVE','now','now');");
  await runMigrations(db as any);
  expect(await balance('v')).toBe(9); expect(await batchTotal('v')).toBe(9);
  expect((await storeRepository.batches('v'))[0].expiration_date).toBeNull();
});

test('failed V5 migration rolls back added columns and retains the original catalog', async () => {
  db.close(); db = new TestSqlite(); (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(MIGRATION_V1 + MIGRATION_V2 + MIGRATION_V3 + MIGRATION_V4);
  await db.execAsync("INSERT INTO schema_migrations VALUES (1,'now'),(2,'now'),(3,'now'),(4,'now'); INSERT INTO products VALUES ('p','Milk',NULL,NULL,NULL,NULL,'ACTIVE','now','now'); CREATE TABLE stock_batches (id TEXT PRIMARY KEY);");
  await expect(runMigrations(db as any)).rejects.toThrow();
  expect((await db.getAllAsync('PRAGMA table_info(product_variants);')).some(column => column.name === 'pack_size')).toBe(false);
  expect(await db.getFirstAsync('SELECT version FROM schema_migrations WHERE version = 5;')).toBeNull();
  expect((await db.getFirstAsync('SELECT name FROM products;')).name).toBe('Milk');
});

test('concurrent checkouts serialize instead of overselling or nesting transactions', async () => {
  const p = await product('Milk', 1);
  const results = await Promise.allSettled([1, 2].map(() => salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CASH' })));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await balance(p.variants[0].id)).toBe(0); expect(await batchTotal(p.variants[0].id)).toBe(0);
});

test('negative-stock debt, receiving, and voids preserve physical batch totals', async () => {
  const p = await product('Milk', 2); const v = p.variants[0].id;
  await storeRepository.setSetting('allow_negative_stock', 'true');
  const sale = await salesService.commitSale({ items: [cart(p, 5)], discountMinor: 0, paymentMethod: 'CASH' });
  expect(await balance(v)).toBe(-3); expect(await batchTotal(v)).toBe(0);
  await salesService.voidSale(sale.id, 'Cancelled');
  expect(await balance(v)).toBe(2); expect(await batchTotal(v)).toBe(2);
  await stockRepository.recordMovement({ variantId: v, movementType: 'DAMAGE', quantityDelta: -5 });
  await storeRepository.receive('', [{ variantId: v, quantity: 1, unitCostMinor: null, expirationDate: null }]);
  expect(await balance(v)).toBe(-2); expect(await batchTotal(v)).toBe(0);
});

test('ledger reconciliation also reconciles physical batch totals', async () => {
  const p = await product(); const v = p.variants[0].id;
  await db.runAsync("INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, occurred_at) VALUES ('manual', ?, 'ADJUSTMENT', -3, 'now');", [v]);
  await stockRepository.reconcileAllVariants();
  expect(await balance(v)).toBe(7); expect(await batchTotal(v)).toBe(7);
});

test('corrupt batch totals and fractional money in a backup leave current inventory untouched', async () => {
  const p = await product(); const v = p.variants[0].id;
  await backupService.createFullBackup();
  const calls = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls;
  const payload = JSON.parse(calls[calls.length - 1][1]);
  payload.data.stock_batches[0].quantity = 999;
  await expect(backupService.restoreBackup(JSON.stringify(payload))).rejects.toThrow('batch quantities');
  expect(await balance(v)).toBe(10); expect(await batchTotal(v)).toBe(10);
  payload.data.product_variants[0].price_minor = 1.5;
  await expect(backupService.restoreBackup(JSON.stringify(payload))).rejects.toThrow('Invalid numeric');
  expect(await balance(v)).toBe(10);
});

test('unpaid credit void reverses receivables without adding cash receipts', async () => {
  const p = await product(); await storeRepository.addCustomer('Ana'); const customer = (await storeRepository.customers())[0];
  const sale = await salesService.commitSale({ items: [cart(p)], discountMinor: 0, paymentMethod: 'CREDIT', customerId: customer.id });
  await salesService.voidSale(sale.id, 'Cancelled');
  expect((await storeRepository.customers())[0].balance_minor).toBe(0);
  expect((await storeRepository.closing('2000-01-01', '2099-01-01')).payments).toBe(0);
  expect(await balance(p.variants[0].id)).toBe(10);
});

test('failure creating an opening batch rolls back the new product and variant', async () => {
  await db.execAsync("CREATE TRIGGER reject_batch BEFORE INSERT ON stock_batches BEGIN SELECT RAISE(ABORT, 'Test disk failure'); END;");
  await expect(product()).rejects.toThrow('Test disk failure');
  expect(await db.getAllAsync('SELECT * FROM products;')).toEqual([]);
  expect(await db.getAllAsync('SELECT * FROM product_variants;')).toEqual([]);
  expect(await db.getAllAsync('SELECT * FROM stock_movements;')).toEqual([]);
});
