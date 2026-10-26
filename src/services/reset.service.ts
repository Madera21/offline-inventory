import { DeviceEventEmitter } from 'react-native';
import { withInventoryTransaction } from '../db/writeTransaction';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../db/database';
import { cartStore } from '../store/cart.store';

/** Clears app records and app-owned local files. Does not touch externally saved backups. */
export async function deleteAllAppData(): Promise<{ failedFiles: number }> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error('App storage is unavailable. No data was deleted.');
  const entries = await FileSystem.readDirectoryAsync(baseDir);
  // Only known app-owned names are eligible; never delete arbitrary document entries.
  const files = entries.filter((name) =>
    name === 'images' || /^(offline_inventory_backup_\d+\.json|(?:products_catalog|products_inventory|sales_report)_\d+\.csv)$/.test(name)
  );
  const db = await getDatabase();
  await withInventoryTransaction(db, async () => {
    await db.execAsync(`
      DELETE FROM sale_batch_allocations;
      DELETE FROM delivery_items;
      DELETE FROM deliveries;
      DELETE FROM credit_entries;
      DELETE FROM expenses;
      DELETE FROM shopping_list;
      DELETE FROM stock_batches;
      DELETE FROM sale_items;
      DELETE FROM stock_movements;
      DELETE FROM sales;
      DELETE FROM customers;
      DELETE FROM product_attribute_values;
      DELETE FROM product_attributes;
      DELETE FROM product_images;
      DELETE FROM product_variants;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM app_settings;
      INSERT INTO app_settings (key, value) VALUES ('currency_code', 'PHP');
      INSERT INTO app_settings (key, value) VALUES ('currency_symbol', '₱');
      INSERT INTO app_settings (key, value) VALUES ('allow_negative_stock', 'false');
    `);
  });
  cartStore.clear();
  DeviceEventEmitter.emit('inventory-restored');

  let failedFiles = 0;
  for (const name of files) {
    try {
      await FileSystem.deleteAsync(`${baseDir}${name}`, { idempotent: true });
    } catch {
      failedFiles++;
    }
  }
  return { failedFiles };
}
