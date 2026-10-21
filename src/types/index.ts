export type EntityStatus = 'ACTIVE' | 'ARCHIVED';

export type ValueType = 'text' | 'number' | 'select';

export type StockMovementType =
  | 'OPENING_STOCK'
  | 'RESTOCK'
  | 'SALE'
  | 'CUSTOMER_RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'VOID_REVERSAL';

export type PaymentMethod = 'CASH' | 'E-WALLET' | 'CARD' | 'OTHER';

export type SaleStatus = 'COMPLETED' | 'VOIDED';

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  brand: string | null;
  notes: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  sku: string | null;
  barcode: string | null;
  unit_label: string;
  cost_minor: number | null;
  price_minor: number;
  low_stock_threshold: number | null;
  stock_quantity: number;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  relative_path: string;
  sort_order: number;
  created_at: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  value_type: ValueType;
  category_id: string | null;
  created_at: string;
}

export interface ProductAttributeValue {
  id: string;
  attribute_id: string;
  product_id: string | null;
  variant_id: string | null;
  value: string;
}

export interface StockMovement {
  id: string;
  variant_id: string;
  movement_type: StockMovementType;
  quantity_delta: number;
  reason: string | null;
  occurred_at: string;
  sale_id: string | null;
}

export interface Sale {
  id: string;
  receipt_number: string;
  sold_at: string;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  quantity: number;
  unit_price_minor: number;
  unit_cost_minor: number | null;
  line_total_minor: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface ProductWithDetails extends Product {
  category_name?: string | null;
  variants: ProductVariant[];
  images: ProductImage[];
  total_stock: number;
  primary_price_minor: number;
  has_multiple_variants: boolean;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  notes?: string | null;
  price_minor: number;
  cost_minor?: number | null;
  opening_stock?: number;
  unit_label?: string;
  sku?: string | null;
  barcode?: string | null;
  low_stock_threshold?: number | null;
  image_relative_paths?: string[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  notes?: string | null;
  status?: EntityStatus;
}
