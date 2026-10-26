jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-id') }));
jest.mock('../src/db/repositories/stock.repository', () => ({ stockRepository: { recordMovement: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///app/', writeAsStringAsync: jest.fn(), EncodingType: { UTF8: 'utf8' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('../src/services/image.service', () => ({ ensureImagesDirectoryExists: jest.fn() }));

import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../src/db/database';
import { ProductsRepository } from '../src/db/repositories/products.repository';
import { BackupService } from '../src/services/backup.service';
import { runMigrations } from '../src/db/migrations';
import { MIGRATION_V4 } from '../src/db/schema';

const db = {
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]), runAsync: jest.fn().mockResolvedValue(undefined),
  execAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn(async operation => operation()),
};
const repository = new ProductsRepository();
beforeEach(() => { jest.clearAllMocks(); db.getAllAsync.mockResolvedValue([]); (getDatabase as jest.Mock).mockResolvedValue(db); });

test('creates products and variants with dates persisted in SQL', async () => {
  const product = await repository.create({ name: 'Milk', price_minor: 100, expiration_date: '2026-11-01' });
  expect(product.variants[0].expiration_date).toBe('2026-11-01');
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('expiration_date)'), expect.arrayContaining(['2026-11-01']));
  const variant = await repository.addVariant('p1', { label: 'Small', price_minor: 100, expiration_date: '2026-11-02' });
  expect(variant.expiration_date).toBe('2026-11-02');
  expect(db.runAsync).toHaveBeenLastCalledWith(expect.stringContaining('expiration_date)'), expect.arrayContaining(['2026-11-02']));
});

test('updates and clears expiration independently of stock', async () => {
  await repository.updateVariantExpiration('v1', '2026-12-01');
  expect(db.runAsync).toHaveBeenLastCalledWith(expect.stringContaining('SET expiration_date'), ['2026-12-01', expect.any(String), 'v1']);
  await repository.updateVariantExpiration('v1', '');
  expect(db.runAsync).toHaveBeenLastCalledWith(expect.not.stringContaining('stock_quantity ='), [null, expect.any(String), 'v1']);
});

test('rejects invalid dates before writing any records', async () => {
  await expect(repository.create({ name: 'Milk', price_minor: 100, expiration_date: '2026-02-30' })).rejects.toThrow();
  await expect(repository.addVariant('p1', { label: 'Small', price_minor: 100, expiration_date: 'bad' })).rejects.toThrow();
  await expect(repository.updateVariantExpiration('v1', 'bad')).rejects.toThrow();
  expect(db.runAsync).not.toHaveBeenCalled();
});

test('migrates existing catalogs once without rebuilding tables', async () => {
  db.getAllAsync.mockResolvedValue([1, 2, 3].map(version => ({ version })));
  await runMigrations(db as any);
  expect(db.execAsync).toHaveBeenCalledWith(MIGRATION_V4);
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'), [4, expect.any(String)]);
  jest.clearAllMocks();
  db.getAllAsync.mockResolvedValue([1, 2, 3, 4].map(version => ({ version })));
  await runMigrations(db as any);
  expect(db.execAsync).not.toHaveBeenCalledWith(MIGRATION_V4);
});

function backup(date?: string) {
  return JSON.stringify({ manifest: { format_version: 1, schema_version: date ? 4 : 3 },
    data: { categories: [], products: [], product_variants: [{ id: 'v1', expiration_date: date }],
      sales: [], sale_items: [], stock_movements: [] }, images_base64: {} });
}

test.each(['2026-11-01', undefined])('restores expiration from new or legacy backups: %s', async date => {
  await new BackupService().restoreBackup(backup(date));
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('expiration_date)'), expect.arrayContaining([date || null]));
});

test('rejects malformed expiration before deleting current data during restore', async () => {
  await expect(new BackupService().restoreBackup(backup('2026-02-30'))).rejects.toThrow();
  expect(db.execAsync).not.toHaveBeenCalled();
  expect(db.withTransactionAsync).not.toHaveBeenCalled();
});

test('backup export and restore round-trip the expiration field', async () => {
  db.getAllAsync.mockImplementation(async (sql: string) => sql === 'SELECT * FROM product_variants;'
    ? [{ id: 'v1', product_id: 'p1', expiration_date: '2027-02-28', stock_quantity: 4 }]
    : sql === 'SELECT * FROM stock_batches;' ? [{ id: 'b1', variant_id: 'v1', quantity: 4, expiration_date: '2027-02-28', received_at: '2026-10-24' }] : []);
  const service = new BackupService();
  await service.createFullBackup();
  const raw = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
  const payload = JSON.parse(raw);
  expect(payload.manifest.schema_version).toBe(5);
  expect(payload.data.product_variants[0].expiration_date).toBe('2027-02-28');
  await service.restoreBackup(raw);
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('expiration_date)'), expect.arrayContaining(['2027-02-28']));
});
