import { categoriesRepository } from '../db/repositories/categories.repository';
import { productsRepository } from '../db/repositories/products.repository';
import { salesService } from '../services/sales.service';
import { stockRepository } from '../db/repositories/stock.repository';

export async function seedDemoData(): Promise<{ productsCount: number; categoriesCount: number }> {
  // 1. Create categories
  const bevCat = await categoriesRepository.create('Beverages');
  const grocCat = await categoriesRepository.create('Groceries');
  const elecCat = await categoriesRepository.create('Electronics');

  // 2. Create products with opening stock
  const p1 = await productsRepository.create({
    name: 'San Miguel Pale Pilsen 330ml',
    category_id: bevCat.id,
    brand: 'San Miguel',
    unit_label: 'bottle',
    price_minor: 4500, // ₱45.00
    cost_minor: 3200,  // ₱32.00
    opening_stock: 48,
    low_stock_threshold: 12,
    sku: 'BEV-SMP-330',
    description: 'Iconic Filipino lager beer.',
  });

  const p2 = await productsRepository.create({
    name: 'Royal Tru-Orange 500ml',
    category_id: bevCat.id,
    brand: 'Coca-Cola',
    unit_label: 'bottle',
    price_minor: 3500, // ₱35.00
    cost_minor: 2400,  // ₱24.00
    opening_stock: 24,
    low_stock_threshold: 6,
    sku: 'BEV-RTO-500',
  });

  const p3 = await productsRepository.create({
    name: 'Sinandomeng Rice (5kg)',
    category_id: grocCat.id,
    brand: 'Golden Harvest',
    unit_label: 'pack',
    price_minor: 29000, // ₱290.00
    cost_minor: 24000,  // ₱240.00
    opening_stock: 10,
    low_stock_threshold: 3,
    sku: 'GRO-RICE-5K',
  });

  // Product with multiple variants
  const p4 = await productsRepository.create({
    name: 'Heavy-Duty Extension Cord',
    category_id: elecCat.id,
    brand: 'Omni',
    unit_label: 'piece',
    price_minor: 28000, // ₱280.00
    cost_minor: 19000,  // ₱190.00
    opening_stock: 12,
    sku: 'ELE-EXT-3M',
  });

  // Add 5M variant to p4
  await productsRepository.addVariant(p4.id, {
    label: '5-Meter Cord',
    unit_label: 'piece',
    price_minor: 42000, // ₱420.00
    cost_minor: 30000,  // ₱300.00
    initial_stock: 8,
    sku: 'ELE-EXT-5M',
    low_stock_threshold: 2,
  });

  // 3. Record a sample sale
  const primaryVariantP1 = p1.variants[0];
  const primaryVariantP2 = p2.variants[0];

  if (primaryVariantP1 && primaryVariantP2) {
    await salesService.commitSale({
      items: [
        {
          variant_id: primaryVariantP1.id,
          product_id: p1.id,
          product_name: p1.name,
          variant_label: primaryVariantP1.label,
          unit_label: primaryVariantP1.unit_label,
          unit_price_minor: primaryVariantP1.price_minor,
          unit_cost_minor: primaryVariantP1.cost_minor,
          quantity: 4,
          max_available_stock: primaryVariantP1.stock_quantity,
        },
        {
          variant_id: primaryVariantP2.id,
          product_id: p2.id,
          product_name: p2.name,
          variant_label: primaryVariantP2.label,
          unit_label: primaryVariantP2.unit_label,
          unit_price_minor: primaryVariantP2.price_minor,
          unit_cost_minor: primaryVariantP2.cost_minor,
          quantity: 2,
          max_available_stock: primaryVariantP2.stock_quantity,
        },
      ],
      discountMinor: 0,
      paymentMethod: 'CASH',
    });
  }

  return { productsCount: 4, categoriesCount: 3 };
}
