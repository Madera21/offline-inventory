import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../db/database';
import { CURRENT_SCHEMA_VERSION } from '../db/schema';
import { getCurrentIsoTimestamp } from '../utils/dates';
import { ensureImagesDirectoryExists } from './image.service';

export interface BackupManifest {
  format_version: number;
  app_version: string;
  schema_version: number;
  created_at: string;
  record_counts: {
    categories: number;
    products: number;
    variants: number;
    sales: number;
    sale_items: number;
    stock_movements: number;
    images: number;
  };
}

export interface BackupPayload {
  manifest: BackupManifest;
  data: {
    categories: any[];
    products: any[];
    product_variants: any[];
    product_attributes: any[];
    product_attribute_values: any[];
    product_images: any[];
    sales: any[];
    sale_items: any[];
    stock_movements: any[];
    app_settings: any[];
  };
  images_base64: Record<string, string>; // relative_path -> base64 string
}

export class BackupService {
  /**
   * Generates a complete self-contained offline backup package (database records + images).
   */
  async createFullBackup(): Promise<string> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();

    // Fetch all tables
    const categories = await db.getAllAsync('SELECT * FROM categories;');
    const products = await db.getAllAsync('SELECT * FROM products;');
    const product_variants = await db.getAllAsync('SELECT * FROM product_variants;');
    const product_attributes = await db.getAllAsync('SELECT * FROM product_attributes;');
    const product_attribute_values = await db.getAllAsync('SELECT * FROM product_attribute_values;');
    const product_images = await db.getAllAsync<{ id: string; product_id: string; relative_path: string }>('SELECT * FROM product_images;');
    const sales = await db.getAllAsync('SELECT * FROM sales;');
    const sale_items = await db.getAllAsync('SELECT * FROM sale_items;');
    const stock_movements = await db.getAllAsync('SELECT * FROM stock_movements;');
    const app_settings = await db.getAllAsync('SELECT * FROM app_settings;');

    // Pack referenced images as base64
    const imagesBase64: Record<string, string> = {};
    const baseDir = FileSystem.documentDirectory;

    for (const img of product_images) {
      if (img.relative_path && baseDir) {
        try {
          const fullUri = `${baseDir}${img.relative_path}`;
          const info = await FileSystem.getInfoAsync(fullUri);
          if (info.exists) {
            const b64 = await FileSystem.readAsStringAsync(fullUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            imagesBase64[img.relative_path] = b64;
          }
        } catch (e) {
          console.warn(`[Backup] Skipping missing image ${img.relative_path}:`, e);
        }
      }
    }

    const manifest: BackupManifest = {
      format_version: 1,
      app_version: '1.0.0',
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: now,
      record_counts: {
        categories: categories.length,
        products: products.length,
        variants: product_variants.length,
        sales: sales.length,
        sale_items: sale_items.length,
        stock_movements: stock_movements.length,
        images: Object.keys(imagesBase64).length,
      },
    };

    const payload: BackupPayload = {
      manifest,
      data: {
        categories,
        products,
        product_variants,
        product_attributes,
        product_attribute_values,
        product_images,
        sales,
        sale_items,
        stock_movements,
        app_settings,
      },
      images_base64: imagesBase64,
    };

    const filename = `offline_inventory_backup_${Date.now()}.json`;
    const targetUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(targetUri, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return targetUri;
  }

  /**
   * Restores a backup payload after validating structure and version.
   */
  async restoreBackup(backupJsonString: string): Promise<BackupManifest> {
    let payload: BackupPayload;
    try {
      payload = JSON.parse(backupJsonString);
    } catch {
      throw new Error('Invalid backup file format: JSON parsing failed.');
    }

    // 1. Validate manifest
    if (!payload.manifest || payload.manifest.format_version !== 1) {
      throw new Error('Incompatible or unrecognized backup format.');
    }

    if (!payload.data) {
      throw new Error('Corrupted backup file: missing data tables.');
    }

    const db = await getDatabase();
    const baseDir = FileSystem.documentDirectory;
    await ensureImagesDirectoryExists();

    // 2. Execute full transactional replacement
    await db.withTransactionAsync(async () => {
      // Clear existing tables in safe order
      await db.execAsync(`
        DELETE FROM sale_items;
        DELETE FROM stock_movements;
        DELETE FROM sales;
        DELETE FROM product_attribute_values;
        DELETE FROM product_attributes;
        DELETE FROM product_images;
        DELETE FROM product_variants;
        DELETE FROM products;
        DELETE FROM categories;
      `);

      // Restore categories
      for (const c of payload.data.categories) {
        await db.runAsync(
          'INSERT INTO categories (id, name, parent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
          [c.id, c.name, c.parent_id, c.status, c.created_at, c.updated_at]
        );
      }

      // Restore products
      for (const p of payload.data.products) {
        await db.runAsync(
          'INSERT INTO products (id, name, description, category_id, brand, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
          [p.id, p.name, p.description, p.category_id, p.brand, p.notes, p.status, p.created_at, p.updated_at]
        );
      }

      // Restore variants
      for (const v of payload.data.product_variants) {
        await db.runAsync(
          'INSERT INTO product_variants (id, product_id, label, sku, barcode, unit_label, cost_minor, price_minor, low_stock_threshold, stock_quantity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
          [v.id, v.product_id, v.label, v.sku, v.barcode, v.unit_label, v.cost_minor, v.price_minor, v.low_stock_threshold, v.stock_quantity, v.status, v.created_at, v.updated_at]
        );
      }

      // Restore attributes
      if (payload.data.product_attributes) {
        for (const a of payload.data.product_attributes) {
          await db.runAsync(
            'INSERT INTO product_attributes (id, name, value_type, category_id, created_at) VALUES (?, ?, ?, ?, ?);',
            [a.id, a.name, a.value_type, a.category_id, a.created_at]
          );
        }
      }

      if (payload.data.product_attribute_values) {
        for (const av of payload.data.product_attribute_values) {
          await db.runAsync(
            'INSERT INTO product_attribute_values (id, attribute_id, product_id, variant_id, value) VALUES (?, ?, ?, ?, ?);',
            [av.id, av.attribute_id, av.product_id, av.variant_id, av.value]
          );
        }
      }

      // Restore images
      if (payload.data.product_images) {
        for (const img of payload.data.product_images) {
          await db.runAsync(
            'INSERT INTO product_images (id, product_id, relative_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?);',
            [img.id, img.product_id, img.relative_path, img.sort_order, img.created_at]
          );
        }
      }

      // Restore sales
      for (const s of payload.data.sales) {
        await db.runAsync(
          'INSERT INTO sales (id, receipt_number, sold_at, subtotal_minor, discount_minor, total_minor, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
          [s.id, s.receipt_number, s.sold_at, s.subtotal_minor, s.discount_minor, s.total_minor, s.payment_method, s.status]
        );
      }

      // Restore sale items
      for (const si of payload.data.sale_items) {
        await db.runAsync(
          'INSERT INTO sale_items (id, sale_id, variant_id, quantity, unit_price_minor, unit_cost_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [si.id, si.sale_id, si.variant_id, si.quantity, si.unit_price_minor, si.unit_cost_minor, si.line_total_minor]
        );
      }

      // Restore stock movements
      for (const sm of payload.data.stock_movements) {
        await db.runAsync(
          'INSERT INTO stock_movements (id, variant_id, movement_type, quantity_delta, reason, occurred_at, sale_id) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [sm.id, sm.variant_id, sm.movement_type, sm.quantity_delta, sm.reason, sm.occurred_at, sm.sale_id]
        );
      }
    });

    // 3. Restore image files to disk
    if (payload.images_base64 && baseDir) {
      for (const [relPath, b64] of Object.entries(payload.images_base64)) {
        try {
          const destUri = `${baseDir}${relPath}`;
          await FileSystem.writeAsStringAsync(destUri, b64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {
          console.warn(`[Restore] Failed to write image ${relPath}:`, e);
        }
      }
    }

    return payload.manifest;
  }
}

export const backupService = new BackupService();
