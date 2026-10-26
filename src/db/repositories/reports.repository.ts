import { getDatabase } from '../database';

export interface SalesReportMetrics {
  totalRevenueMinor: number;
  transactionCount: number;
  unitsSold: number;
  estimatedGrossProfitMinor: number;
  incompleteCostCount: number;
}

export interface BestSellerItem {
  variant_id: string;
  product_name: string;
  variant_label: string;
  total_quantity: number;
  total_revenue_minor: number;
}

export interface InventoryValuationMetrics {
  totalActiveProducts: number;
  totalVariants: number;
  totalStockUnits: number;
  inventoryRetailValueMinor: number;
  inventoryCostValueMinor: number;
  lowStockItemsCount: number;
}

export class ReportsRepository {
  async getCounterTotals(startDateIso: string, endDateIso: string): Promise<{ total: number; count: number }> {
    const db = await getDatabase();
    return await db.getFirstAsync<{ total: number; count: number }>(
      "SELECT COALESCE(SUM(total_minor), 0) AS total, COUNT(*) AS count FROM sales WHERE status = 'COMPLETED' AND sold_at >= ? AND sold_at < ?",
      startDateIso, endDateIso
    ) || { total: 0, count: 0 };
  }

  async getSalesReport(startDateIso?: string, endDateIso?: string): Promise<SalesReportMetrics> {
    const db = await getDatabase();
    let query = `
      SELECT COUNT(*) AS tx_count, SUM(s.total_minor) AS total_revenue,
        SUM(si.total_units) AS total_units,
        SUM(si.known_profit - CASE WHEN s.subtotal_minor > 0
          THEN ROUND(s.discount_minor * si.known_revenue * 1.0 / s.subtotal_minor) ELSE 0 END) AS gross_profit,
        SUM(si.unknown_cost_items) AS unknown_cost_items
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(quantity) AS total_units,
          SUM(CASE WHEN unit_cost_minor IS NOT NULL THEN line_total_minor - unit_cost_minor * quantity ELSE 0 END) AS known_profit,
          SUM(CASE WHEN unit_cost_minor IS NOT NULL THEN line_total_minor ELSE 0 END) AS known_revenue,
          SUM(CASE WHEN unit_cost_minor IS NULL THEN 1 ELSE 0 END) AS unknown_cost_items
        FROM sale_items GROUP BY sale_id
      ) si ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED'
    `;
    const params: string[] = [];

    if (startDateIso && endDateIso) {
      query += ' AND s.sold_at >= ? AND s.sold_at <= ?';
      params.push(startDateIso, endDateIso);
    } else if (startDateIso) {
      query += ' AND s.sold_at >= ?';
      params.push(startDateIso);
    }

    const row = await db.getFirstAsync<{
      tx_count: number | null;
      total_revenue: number | null;
      total_units: number | null;
      gross_profit: number | null;
      unknown_cost_items: number | null;
    }>(query, params);

    return {
      transactionCount: row?.tx_count ?? 0,
      totalRevenueMinor: row?.total_revenue ?? 0,
      unitsSold: row?.total_units ?? 0,
      estimatedGrossProfitMinor: row?.gross_profit ?? 0,
      incompleteCostCount: row?.unknown_cost_items ?? 0,
    };
  }

  async getBestSellers(limit = 5, startDateIso?: string, availableOnly = false): Promise<BestSellerItem[]> {
    const db = await getDatabase();
    let query = `
      SELECT 
        v.id as variant_id,
        p.name as product_name,
        v.label as variant_label,
        SUM(si.quantity) as total_quantity,
        SUM(si.line_total_minor) as total_revenue_minor
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN product_variants v ON si.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      WHERE s.status = 'COMPLETED'
    `;
    const params: (string | number)[] = [];

    if (availableOnly) {
      query += " AND p.status = 'ACTIVE' AND v.status = 'ACTIVE' AND v.stock_quantity > 0";
    }

    if (startDateIso) {
      query += ' AND s.sold_at >= ?';
      params.push(startDateIso);
    }

    query += `
      GROUP BY v.id
      ORDER BY total_quantity DESC
      LIMIT ?;
    `;
    params.push(limit);

    return await db.getAllAsync<BestSellerItem>(query, params);
  }

  async getInventoryValuation(): Promise<InventoryValuationMetrics> {
    const db = await getDatabase();

    const prodRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM products WHERE status = 'ACTIVE';"
    );

    const variantRow = await db.getFirstAsync<{
      variant_count: number;
      total_units: number | null;
      retail_val: number | null;
      cost_val: number | null;
      low_stock_count: number;
    }>(
      `SELECT 
        COUNT(*) as variant_count,
        SUM(stock_quantity) as total_units,
        SUM(stock_quantity * price_minor) as retail_val,
        SUM(CASE WHEN cost_minor IS NOT NULL THEN stock_quantity * cost_minor ELSE 0 END) as cost_val,
        SUM(CASE WHEN low_stock_threshold IS NOT NULL AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count
       FROM product_variants
       WHERE status = 'ACTIVE';`
    );

    return {
      totalActiveProducts: prodRow?.count ?? 0,
      totalVariants: variantRow?.variant_count ?? 0,
      totalStockUnits: variantRow?.total_units ?? 0,
      inventoryRetailValueMinor: variantRow?.retail_val ?? 0,
      inventoryCostValueMinor: variantRow?.cost_val ?? 0,
      lowStockItemsCount: variantRow?.low_stock_count ?? 0,
    };
  }

  /**
   * Generates CSV format string for products and stock.
   */
  async generateProductsCsv(): Promise<string> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      name: string;
      brand: string | null;
      category_name: string | null;
      label: string;
      unit_label: string;
      sku: string | null;
      barcode: string | null;
      stock_quantity: number;
      price_minor: number;
      cost_minor: number | null;
    }>(
      `SELECT 
        p.name, p.brand, c.name as category_name,
        v.label, v.unit_label, v.sku, v.barcode, v.stock_quantity,
        v.price_minor, v.cost_minor
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN product_variants v ON p.id = v.product_id
       WHERE p.status = 'ACTIVE'
       ORDER BY p.name ASC;`
    );

    const headers = 'Product,Brand,Category,Variant,Unit,SKU,Barcode,Stock,Price,Cost\n';
    const lines = rows.map((r) => {
      const priceDec = (r.price_minor / 100).toFixed(2);
      const costDec = r.cost_minor !== null ? (r.cost_minor / 100).toFixed(2) : '';
      return `"${r.name.replace(/"/g, '""')}","${r.brand || ''}","${r.category_name || ''}","${r.label}","${r.unit_label}","${r.sku || ''}","${r.barcode || ''}",${r.stock_quantity},${priceDec},${costDec}`;
    });

    return headers + lines.join('\n');
  }

  /**
   * Generates CSV format string for sales history.
   */
  async generateSalesCsv(): Promise<string> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      receipt_number: string;
      sold_at: string;
      subtotal_minor: number;
      discount_minor: number;
      total_minor: number;
      payment_method: string;
      status: string;
    }>('SELECT * FROM sales ORDER BY sold_at DESC;');

    const headers = 'Receipt,Date,Subtotal,Discount,Total,PaymentMethod,Status\n';
    const lines = rows.map((r) => {
      const subtotal = (r.subtotal_minor / 100).toFixed(2);
      const discount = (r.discount_minor / 100).toFixed(2);
      const total = (r.total_minor / 100).toFixed(2);
      return `"${r.receipt_number}","${r.sold_at}",${subtotal},${discount},${total},"${r.payment_method}","${r.status}"`;
    });

    return headers + lines.join('\n');
  }
}

export const reportsRepository = new ReportsRepository();
