import { withInventoryTransaction } from '../writeTransaction';
import { StockBatch, openingBatch } from '../batches';
import { minorAmount, wholeQuantity } from '../../utils/quantities';
import * as Crypto from 'expo-crypto';
import { normalizeExpirationDate } from '../../utils/expiration';
import { getDatabase } from '../database';
import {
  Product,
  ProductVariant,
  ProductImage,
  ProductWithDetails,
  CreateProductInput,
  UpdateProductInput,
  EntityStatus,
} from '../../types';
import { getCurrentIsoTimestamp } from '../../utils/dates';
import { barcodeCandidates } from '../../utils/barcode';

const variantsWithStockedTotal = `SELECT v.*, MAX(v.stock_quantity, COALESCE((
  SELECT SUM(m.quantity_delta) FROM stock_movements m WHERE m.variant_id = v.id
  AND m.quantity_delta > 0 AND m.movement_type IN ('OPENING_STOCK', 'RESTOCK', 'ADJUSTMENT')
), 0)) AS total_stocked FROM product_variants v`;

export class DuplicateBarcodeError extends Error {
  constructor(public productId: string, productName: string) {
    super(`This barcode already belongs to "${productName}". Open the existing product to edit it or add stock.`);
    this.name = 'DuplicateBarcodeError';
  }
}

export class ProductsRepository {
  async findExistingBarcode(code: string): Promise<{ product_id: string; product_name: string } | null> {
    const candidates = barcodeCandidates(code);
    if (!candidates.length) return null;
    const db = await getDatabase();
    return db.getFirstAsync<{ product_id: string; product_name: string }>(
      `SELECT v.product_id, p.name AS product_name FROM product_variants v
       JOIN products p ON p.id = v.product_id
       WHERE TRIM(v.barcode) IN (${candidates.map(() => '?').join(',')}) ORDER BY CASE WHEN p.status = 'ACTIVE' AND v.status = 'ACTIVE' THEN 0 ELSE 1 END, v.created_at ASC LIMIT 1;`,
      candidates
    );
  }

  private async assertBarcodeAvailable(code?: string | null): Promise<void> {
    if (!code?.trim()) return;
    const existing = await this.findExistingBarcode(code);
    if (existing) throw new DuplicateBarcodeError(existing.product_id, existing.product_name);
  }
  async getAllWithDetails(options?: {
    search?: string;
    categoryId?: string | null;
    status?: EntityStatus;
    lowStockOnly?: boolean;
  }): Promise<ProductWithDetails[]> {
    const db = await getDatabase();
    const status = options?.status ?? 'ACTIVE';

    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = ?
    `;
    const params: (string | number)[] = [status];

    if (options?.categoryId) {
      query += ' AND p.category_id = ?';
      params.push(options.categoryId);
    }

    if (options?.search && options.search.trim() !== '') {
      const term = `%${options.search.trim()}%`;
      query += ` AND (
        p.name LIKE ? OR 
        p.brand LIKE ? OR 
        p.description LIKE ? OR
        p.id IN (
          SELECT product_id FROM product_variants 
          WHERE sku LIKE ? OR barcode LIKE ? OR label LIKE ?
        )
      )`;
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY p.name ASC;';

    const products = await db.getAllAsync<Product & { category_name: string | null }>(query, params);
    if (products.length === 0) return [];

    // Load variants and images for all returned products
    const productIds = products.map((p) => p.id);
    const placeholders = productIds.map(() => '?').join(',');

    const variants = await db.getAllAsync<ProductVariant>(
      `${variantsWithStockedTotal}
       WHERE product_id IN (${placeholders}) AND status = 'ACTIVE'
       ORDER BY created_at ASC;`,
      productIds
    );

    const batchRows = variants.length ? await db.getAllAsync<StockBatch>(
      `SELECT * FROM stock_batches WHERE quantity > 0 AND variant_id IN (${variants.map(() => '?').join(',')});`,
      variants.map(variant => variant.id)
    ) : [];
    for (const variant of variants) variant.batches = batchRows.filter(batch => batch.variant_id === variant.id);

    const images = await db.getAllAsync<ProductImage>(
      `SELECT * FROM product_images 
       WHERE product_id IN (${placeholders})
       ORDER BY sort_order ASC, created_at ASC;`,
      productIds
    );

    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = variantsByProduct.get(v.product_id) || [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    }

    const imagesByProduct = new Map<string, ProductImage[]>();
    for (const img of images) {
      const list = imagesByProduct.get(img.product_id) || [];
      list.push(img);
      imagesByProduct.set(img.product_id, list);
    }

    const result: ProductWithDetails[] = [];

    for (const p of products) {
      const pVariants = variantsByProduct.get(p.id) || [];
      const pImages = imagesByProduct.get(p.id) || [];
      const totalStock = pVariants.reduce((sum, v) => sum + v.stock_quantity, 0);
      const primaryPriceMinor = pVariants[0]?.price_minor ?? 0;
      const hasMultipleVariants = pVariants.length > 1;

      // Filter by low stock if requested
      if (options?.lowStockOnly) {
        const isLow = pVariants.some(
          (v) => v.low_stock_threshold !== null && v.stock_quantity <= v.low_stock_threshold
        );
        if (!isLow) continue;
      }

      result.push({
        ...p,
        variants: pVariants,
        images: pImages,
        total_stock: totalStock,
        total_stocked: pVariants.reduce((sum, v) => sum + (v.total_stocked ?? v.stock_quantity), 0),
        primary_price_minor: primaryPriceMinor,
        has_multiple_variants: hasMultipleVariants,
      });
    }

    return result;
  }

  async getByIdWithDetails(id: string): Promise<ProductWithDetails | null> {
    const db = await getDatabase();
    const product = await db.getFirstAsync<Product & { category_name: string | null }>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?;`,
      [id]
    );

    if (!product) return null;

    const variants = await db.getAllAsync<ProductVariant>(
      `${variantsWithStockedTotal} WHERE product_id = ? AND status = 'ACTIVE' ORDER BY created_at ASC;`,
      [id]
    );

    const batchRows = variants.length ? await db.getAllAsync<StockBatch>(
      `SELECT * FROM stock_batches WHERE quantity > 0 AND variant_id IN (${variants.map(() => '?').join(',')});`,
      variants.map(variant => variant.id)
    ) : [];
    for (const variant of variants) variant.batches = batchRows.filter(batch => batch.variant_id === variant.id);

    const images = await db.getAllAsync<ProductImage>(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC;',
      [id]
    );

    const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);
    const primaryPriceMinor = variants[0]?.price_minor ?? 0;

    return {
      ...product,
      variants,
      images,
      total_stock: totalStock,
      total_stocked: variants.reduce((sum, v) => sum + (v.total_stocked ?? v.stock_quantity), 0),
      primary_price_minor: primaryPriceMinor,
      has_multiple_variants: variants.length > 1,
    };
  }

  async findByBarcodeOrSku(
    code: string
  ): Promise<{ product: ProductWithDetails; variant: ProductVariant } | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const candidates = barcodeCandidates(trimmed);
    const db = await getDatabase();
    const variant = await db.getFirstAsync<ProductVariant>(
      `SELECT v.* FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE (TRIM(v.barcode) IN (${candidates.map(() => '?').join(',')}) OR TRIM(v.sku) = ?)
         AND v.status = 'ACTIVE' AND p.status = 'ACTIVE'
       ORDER BY CASE WHEN TRIM(v.barcode) = ? THEN 0 WHEN TRIM(v.barcode) IN (${candidates.map(() => '?').join(',')}) THEN 1 ELSE 2 END,
         v.created_at ASC, v.id ASC LIMIT 1;`,
      [...candidates, trimmed, trimmed, ...candidates]
    );
    if (!variant) return null;
    const product = await this.getByIdWithDetails(variant.product_id);
    if (!product) return null;
    return { product, variant: product.variants.find(item => item.id === variant.id) ?? variant };
  }

  async create(input: CreateProductInput): Promise<ProductWithDetails> {
    minorAmount(input.price_minor);
    if (input.cost_minor !== undefined && input.cost_minor !== null) minorAmount(input.cost_minor, true);
    wholeQuantity(input.opening_stock ?? 0, true);
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const productId = Crypto.randomUUID();
    const defaultVariantId = Crypto.randomUUID();

    const product: Product = {
      id: productId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category_id: input.category_id || null,
      brand: input.brand?.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    };

    const openingStock = input.opening_stock ?? 0;
    const expirationDate = normalizeExpirationDate(input.expiration_date);

    const defaultVariant: ProductVariant = {
      id: defaultVariantId,
      product_id: productId,
      label: 'Standard',
      sku: input.sku?.trim() || null,
      barcode: input.barcode?.trim() || null,
      unit_label: input.unit_label?.trim() || 'piece',
      cost_minor: input.cost_minor !== undefined ? input.cost_minor : null,
      price_minor: input.price_minor,
      low_stock_threshold: input.low_stock_threshold !== undefined ? input.low_stock_threshold : null,
      expiration_date: expirationDate,
      stock_quantity: 0,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    };

    const createdImages: ProductImage[] = [];

    await withInventoryTransaction(db, async () => {
      await this.assertBarcodeAvailable(defaultVariant.barcode);
      // 1. Insert product
      await db.runAsync(
        `INSERT INTO products (id, name, description, category_id, brand, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          product.id,
          product.name,
          product.description,
          product.category_id,
          product.brand,
          product.notes,
          product.status,
          product.created_at,
          product.updated_at,
        ]
      );

      // 2. Insert default variant
      await db.runAsync(
        `INSERT INTO product_variants (id, product_id, label, sku, barcode, unit_label, cost_minor, price_minor, low_stock_threshold, stock_quantity, status, created_at, updated_at, expiration_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          defaultVariant.id,
          defaultVariant.product_id,
          defaultVariant.label,
          defaultVariant.sku,
          defaultVariant.barcode,
          defaultVariant.unit_label,
          defaultVariant.cost_minor,
          defaultVariant.price_minor,
          defaultVariant.low_stock_threshold,
          0,
          defaultVariant.status,
          defaultVariant.created_at,
          defaultVariant.updated_at,
          expirationDate,
        ]
      );

      // 3. Insert images if provided
      if (input.image_relative_paths && input.image_relative_paths.length > 0) {
        let sort = 0;
        for (const relPath of input.image_relative_paths) {
          const img: ProductImage = {
            id: Crypto.randomUUID(),
            product_id: productId,
            relative_path: relPath,
            frame_json: input.image_frame_json ?? null,
            sort_order: sort++,
            created_at: now,
          };
          await db.runAsync(
            `INSERT INTO product_images (id, product_id, relative_path, sort_order, created_at, frame_json)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [img.id, img.product_id, img.relative_path, img.sort_order, img.created_at, img.frame_json ?? null]
          );
          createdImages.push(img);
        }
      }
      await openingBatch(db, defaultVariant.id, openingStock, expirationDate, now);
      defaultVariant.stock_quantity = openingStock;
      defaultVariant.total_stocked = openingStock;
    });

    return {
      ...product,
      variants: [defaultVariant],
      images: createdImages,
      total_stock: defaultVariant.stock_quantity,
      total_stocked: defaultVariant.stock_quantity,
      primary_price_minor: defaultVariant.price_minor,
      has_multiple_variants: false,
    };
  }

  async update(id: string, input: UpdateProductInput): Promise<void> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name.trim());
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description ? input.description.trim() : null);
    }
    if (input.category_id !== undefined) {
      updates.push('category_id = ?');
      params.push(input.category_id);
    }
    if (input.brand !== undefined) {
      updates.push('brand = ?');
      params.push(input.brand ? input.brand.trim() : null);
    }
    if (input.notes !== undefined) {
      updates.push('notes = ?');
      params.push(input.notes ? input.notes.trim() : null);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }

    params.push(id);
    await withInventoryTransaction(db, async () => {
      await db.runAsync(`UPDATE products SET ${updates.join(', ')} WHERE id = ?;`, params);
      if (input.primary_image !== undefined) {
        const existing = await db.getFirstAsync<ProductImage>(
          'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1;', [id]);
        if (input.primary_image === null) {
          if (existing) await db.runAsync('DELETE FROM product_images WHERE id = ? AND product_id = ?;', [existing.id, id]);
        } else if (existing) {
          await db.runAsync('UPDATE product_images SET relative_path = ?, frame_json = ? WHERE id = ? AND product_id = ?;',
            [input.primary_image.relative_path, input.primary_image.frame_json, existing.id, id]);
        } else {
          await db.runAsync('INSERT INTO product_images (id, product_id, relative_path, sort_order, created_at, frame_json) VALUES (?, ?, ?, ?, ?, ?);',
            [Crypto.randomUUID(), id, input.primary_image.relative_path, 0, now, input.primary_image.frame_json]);
        }
      }
    });
  }

  async addVariant(
    productId: string,
    variantData: {
      label: string;
      sku?: string | null;
      barcode?: string | null;
      unit_label?: string;
      price_minor: number;
      cost_minor?: number | null;
      low_stock_threshold?: number | null;
      expiration_date?: string | null;
      initial_stock?: number;
    }
  ): Promise<ProductVariant> {
    minorAmount(variantData.price_minor);
    if (variantData.cost_minor !== undefined && variantData.cost_minor !== null) minorAmount(variantData.cost_minor, true);
    wholeQuantity(variantData.initial_stock ?? 0, true);
    const db = await getDatabase();
    return withInventoryTransaction(db, async () => {
      await this.assertBarcodeAvailable(variantData.barcode);
      const now = getCurrentIsoTimestamp();
      const variantId = Crypto.randomUUID();
      const expirationDate = normalizeExpirationDate(variantData.expiration_date);

      const variant: ProductVariant = {
        id: variantId,
        product_id: productId,
        label: variantData.label.trim(),
        sku: variantData.sku?.trim() || null,
        barcode: variantData.barcode?.trim() || null,
        unit_label: variantData.unit_label?.trim() || 'piece',
        cost_minor: variantData.cost_minor !== undefined ? variantData.cost_minor : null,
        price_minor: variantData.price_minor,
        low_stock_threshold: variantData.low_stock_threshold !== undefined ? variantData.low_stock_threshold : null,
        expiration_date: expirationDate,
        stock_quantity: 0,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      };

      await db.runAsync(
        `INSERT INTO product_variants (id, product_id, label, sku, barcode, unit_label, cost_minor, price_minor, low_stock_threshold, stock_quantity, status, created_at, updated_at, expiration_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          variant.id,
          variant.product_id,
          variant.label,
          variant.sku,
          variant.barcode,
          variant.unit_label,
          variant.cost_minor,
          variant.price_minor,
          variant.low_stock_threshold,
          0,
          variant.status,
          variant.created_at,
          variant.updated_at,
          expirationDate,
        ]
      );

      await openingBatch(db, variant.id, variantData.initial_stock ?? 0, expirationDate, now);
      variant.stock_quantity = variantData.initial_stock ?? 0;
      variant.total_stocked = variant.stock_quantity;

      return variant;
    });
  }

  async updateVariantExpiration(variantId: string, value: string | null): Promise<void> {
    const expirationDate = normalizeExpirationDate(value);
    const db = await getDatabase();
    await withInventoryTransaction(db, async () => {
      const batches = await db.getAllAsync<{ id: string }>('SELECT id FROM stock_batches WHERE variant_id = ? AND quantity > 0;', [variantId]);
      if (batches.length > 1) throw new Error('This item has several batches. Open Batches to edit each date.');
      await db.runAsync('UPDATE stock_batches SET expiration_date = ? WHERE variant_id = ? AND quantity > 0;', [expirationDate, variantId]);
      await db.runAsync('UPDATE product_variants SET expiration_date = ?, updated_at = ? WHERE id = ?;',
        [expirationDate, getCurrentIsoTimestamp(), variantId]);
    });
  }

  async addImage(productId: string, relativePath: string): Promise<ProductImage> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const id = Crypto.randomUUID();
    const img: ProductImage = {
      id,
      product_id: productId,
      relative_path: relativePath,
      sort_order: 0,
      created_at: now,
    };
    await db.runAsync(
      `INSERT INTO product_images (id, product_id, relative_path, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [img.id, img.product_id, img.relative_path, img.sort_order, img.created_at]
    );
    return img;
  }

  async updateImageFrame(imageId: string, frameJson: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE product_images SET frame_json = ? WHERE id = ?;', [frameJson, imageId]);
  }

  async removeImage(imageId: string): Promise<string | null> {
    const db = await getDatabase();
    const img = await db.getFirstAsync<ProductImage>(
      'SELECT * FROM product_images WHERE id = ?;',
      [imageId]
    );
    if (!img) return null;
    await db.runAsync('DELETE FROM product_images WHERE id = ?;', [imageId]);
    return img.relative_path;
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { status: 'ARCHIVED' });
  }

  async restore(id: string): Promise<void> {
    await this.update(id, { status: 'ACTIVE' });
  }

  async getDashboardSummary(): Promise<{
    activeProductsCount: number;
    variantsCount: number;
    lowStockCount: number;
    inventoryValueMinor: number;
  }> {
    const db = await getDatabase();

    const prodRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM products WHERE status = 'ACTIVE';"
    );

    const variantRow = await db.getFirstAsync<{
      count: number;
      low_stock_count: number;
      total_cost_minor: number | null;
    }>(
      `SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN low_stock_threshold IS NOT NULL AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN cost_minor IS NOT NULL THEN stock_quantity * cost_minor ELSE 0 END) as total_cost_minor
       FROM product_variants 
       WHERE status = 'ACTIVE';`
    );

    return {
      activeProductsCount: prodRow?.count ?? 0,
      variantsCount: variantRow?.count ?? 0,
      lowStockCount: variantRow?.low_stock_count ?? 0,
      inventoryValueMinor: variantRow?.total_cost_minor ?? 0,
    };
  }
}

export const productsRepository = new ProductsRepository();
