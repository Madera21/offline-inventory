jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app/',
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../src/store/cart.store', () => ({ cartStore: { clear: jest.fn() } }));

import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../src/db/database';
import { cartStore } from '../src/store/cart.store';
import { deleteAllAppData } from '../src/services/reset.service';

describe('Delete all app data', () => {
  const db = {
    execAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (operation) => operation()),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    db.execAsync.mockResolvedValue(undefined);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
      'images', 'offline_inventory_backup_123.json', 'products_catalog_123.csv',
      'products_inventory_123.csv', 'sales_report_123.csv',
      'SQLite', 'unrelated.txt', '../images',
    ]);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  test('clears records and cart, resets defaults, and deletes only app-owned files', async () => {
    expect(await deleteAllAppData()).toEqual({ failedFiles: 0 });
    const sql = db.execAsync.mock.calls[0][0];
    expect(sql).toContain('DELETE FROM sales;');
    expect(sql).toContain('DELETE FROM products;');
    expect(sql).toContain('DELETE FROM app_settings;');
    expect(sql).toContain("('currency_code', 'PHP')");
    expect(sql).not.toContain('schema_migrations');
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(cartStore.clear).toHaveBeenCalledTimes(1);
    expect((FileSystem.deleteAsync as jest.Mock).mock.calls.map(([uri]) => uri)).toEqual([
      'file:///app/images', 'file:///app/offline_inventory_backup_123.json',
      'file:///app/products_catalog_123.csv', 'file:///app/products_inventory_123.csv', 'file:///app/sales_report_123.csv',
    ]);
  });

  test('keeps files and cart untouched if the database reset fails', async () => {
    db.execAsync.mockRejectedValue(new Error('Database failure'));
    await expect(deleteAllAppData()).rejects.toThrow('Database failure');
    expect(cartStore.clear).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  test('reports partial file cleanup rather than claiming everything was deleted', async () => {
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('File locked'));
    expect(await deleteAllAppData()).toEqual({ failedFiles: 1 });
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(5);
    expect(cartStore.clear).toHaveBeenCalled();
  });
});
