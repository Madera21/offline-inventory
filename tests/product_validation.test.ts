import { createProductSchema, createCategorySchema } from '../src/validation/product.schema';

describe('Validation Schema Tests', () => {
  describe('Product Schema', () => {
    test('validates valid product payload', () => {
      const valid = {
        name: 'Pale Pilsen 330ml',
        price: '45.00',
        unit_label: 'bottle',
        brand: 'San Miguel',
        opening_stock: '24',
      };
      const result = createProductSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    test('rejects empty product name', () => {
      const invalid = {
        name: '',
        price: '100',
      };
      const result = createProductSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('defaults unit_label to piece if not provided', () => {
      const payload = {
        name: 'Item without unit',
        price: '50',
      };
      const parsed = createProductSchema.parse(payload);
      expect(parsed.unit_label).toBe('piece');
    });
  });

  describe('Category Schema', () => {
    test('validates valid category name', () => {
      const result = createCategorySchema.safeParse({ name: 'Beverages' });
      expect(result.success).toBe(true);
    });

    test('rejects empty category name', () => {
      const result = createCategorySchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });
});
