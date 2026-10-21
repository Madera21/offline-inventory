import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  category_id: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  unit_label: z.string().default('piece'),
  price: z.string().min(1, 'Price is required'),
  cost: z.string().optional(),
  opening_stock: z.string().optional(),
  low_stock_threshold: z.string().optional(),
});

export type CreateProductFormData = z.infer<typeof createProductSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  parent_id: z.string().nullable().optional(),
});

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>;
