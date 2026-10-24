export const MIGRATION_V5 = `
ALTER TABLE product_variants ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN customer_id TEXT REFERENCES customers(id);
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS credit_entries (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), sale_id TEXT REFERENCES sales(id),
  amount_minor INTEGER NOT NULL, payment_method TEXT NOT NULL, note TEXT, occurred_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, description TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  payment_method TEXT NOT NULL, occurred_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'OPERATING'
);
CREATE TABLE IF NOT EXISTS stock_batches (
  id TEXT PRIMARY KEY, variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK(quantity >= 0), expiration_date TEXT, received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sale_batch_allocations (
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES stock_batches(id), quantity INTEGER NOT NULL CHECK(quantity > 0),
  PRIMARY KEY(sale_item_id, batch_id)
);
CREATE TABLE IF NOT EXISTS shopping_list (
  variant_id TEXT PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK(quantity > 0), checked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY, supplier TEXT, total_cost_minor INTEGER NOT NULL, received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_items (
  id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id), quantity INTEGER NOT NULL,
  unit_cost_minor INTEGER, batch_id TEXT REFERENCES stock_batches(id)
);
CREATE INDEX IF NOT EXISTS idx_batches_variant ON stock_batches(variant_id);
CREATE INDEX IF NOT EXISTS idx_credit_customer ON credit_entries(customer_id);
INSERT INTO stock_batches (id, variant_id, quantity, expiration_date, received_at)
  SELECT 'legacy-' || id, id, stock_quantity, expiration_date, created_at FROM product_variants WHERE stock_quantity > 0;
INSERT OR IGNORE INTO app_settings VALUES ('language', 'en');
INSERT OR IGNORE INTO app_settings VALUES ('backup_reminders', 'true');
`;
export const CURRENT_SCHEMA_VERSION = 5;
export const MIGRATION_V4 = 'ALTER TABLE product_variants ADD COLUMN expiration_date TEXT;';
// Triggers preserve existing duplicates while preventing new ones, including archived records.
export const MIGRATION_V3 = `
CREATE TRIGGER IF NOT EXISTS prevent_duplicate_barcode_insert
BEFORE INSERT ON product_variants
WHEN NEW.barcode IS NOT NULL AND TRIM(NEW.barcode) <> ''
BEGIN
  SELECT RAISE(ABORT, 'Barcode already exists. Open the existing product to update stock.')
  WHERE EXISTS (SELECT 1 FROM product_variants WHERE TRIM(barcode) = TRIM(NEW.barcode));
END;
CREATE TRIGGER IF NOT EXISTS prevent_duplicate_barcode_update
BEFORE UPDATE OF barcode ON product_variants
WHEN NEW.barcode IS NOT NULL AND TRIM(NEW.barcode) <> ''
  AND TRIM(NEW.barcode) IS NOT TRIM(OLD.barcode)
BEGIN
  SELECT RAISE(ABORT, 'Barcode already exists. Open the existing product to update stock.')
  WHERE EXISTS (SELECT 1 FROM product_variants WHERE id <> OLD.id AND TRIM(barcode) = TRIM(NEW.barcode));
END;
`;
export const MIGRATION_V2 = 'ALTER TABLE product_images ADD COLUMN frame_json TEXT;';

export const MIGRATION_V1 = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- General application settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Products catalog identity
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Stock-bearing product variants
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  unit_label TEXT NOT NULL DEFAULT 'piece',
  cost_minor INTEGER,
  price_minor INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Custom attribute definitions
CREATE TABLE IF NOT EXISTS product_attributes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'text',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- Custom attribute values attached to product or variant
CREATE TABLE IF NOT EXISTS product_attribute_values (
  id TEXT PRIMARY KEY,
  attribute_id TEXT NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  value TEXT NOT NULL
);

-- Product local image references
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Sales records
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  sold_at TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED'
);

-- Sale line items with price/cost snapshots
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  unit_cost_minor INTEGER,
  line_total_minor INTEGER NOT NULL
);

-- Stock movements ledger
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reason TEXT,
  occurred_at TEXT NOT NULL,
  sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL
);

-- Indexes for high-performance offline querying
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_occurred ON stock_movements(occurred_at);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);
`;
