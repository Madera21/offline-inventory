jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('../src/db/repositories/stock.repository', () => ({ stockRepository: {} }));

import { barcodeCandidates } from '../src/utils/barcode';
import { getDatabase } from '../src/db/database';
import { ProductsRepository } from '../src/db/repositories/products.repository';

describe('Barcode representation matching', () => {
  test.each(['036000291452', '0036000291452', '00036000291452'])(
    'matches UPC, EAN, and GTIN forms when scanning %s', (code) => {
      expect(barcodeCandidates(code).sort()).toEqual(['036000291452', '0036000291452', '00036000291452'].sort());
    }
  );
  test('keeps nonzero EAN prefixes and unrelated codes distinct', () => {
    expect(barcodeCandidates('4800012345678')).toEqual(['4800012345678', '04800012345678']);
    expect(barcodeCandidates('  ACC-USB-01\n')).toEqual(['ACC-USB-01']);
    expect(barcodeCandidates('0000123')).toEqual(['0000123']);
    expect(barcodeCandidates('  ')).toEqual([]);
  });

  test('repository searches equivalent barcodes but keeps SKU matching exact', async () => {
    const db = { getFirstAsync: jest.fn().mockResolvedValue({ id: 'variant', product_id: 'product' }) };
    (getDatabase as jest.Mock).mockResolvedValue(db);
    const repository = new ProductsRepository();
    jest.spyOn(repository, 'getByIdWithDetails').mockResolvedValue({ id: 'product', variants: [{ id: 'variant', stock_quantity: 9, total_stocked: 10 }] } as any);
    const match = await repository.findByBarcodeOrSku(' 036000291452 ');
    expect(match?.variant.id).toBe('variant');
    expect(match?.variant.total_stocked).toBe(10);
    const [query, params] = db.getFirstAsync.mock.calls[0];
    expect(query).toContain("AND v.status = 'ACTIVE' AND p.status = 'ACTIVE'");
    expect(query).toContain('OR TRIM(v.sku) = ?');
    expect(params).toEqual([
      '036000291452', '00036000291452', '0036000291452',
      '036000291452', '036000291452',
      '036000291452', '00036000291452', '0036000291452',
    ]);
  });
});
