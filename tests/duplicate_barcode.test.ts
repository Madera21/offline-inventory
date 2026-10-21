jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-id') }));
jest.mock('../src/db/repositories/stock.repository', () => ({ stockRepository: { recordMovement: jest.fn() } }));

import { getDatabase } from '../src/db/database';
import { DuplicateBarcodeError, ProductsRepository } from '../src/db/repositories/products.repository';

describe('Duplicate barcode protection in the product repository', () => {
  const db = {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (operation) => operation()),
  };
  const repository = new ProductsRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    db.getFirstAsync.mockResolvedValue(null);
    (getDatabase as jest.Mock).mockResolvedValue(db);
  });

  test('rejects creating another product before inserting any records', async () => {
    db.getFirstAsync.mockResolvedValue({ product_id: 'existing', product_name: 'Water' });
    await expect(repository.create({ name: 'Water again', price_minor: 100, barcode: ' 0123456789 ' }))
      .rejects.toMatchObject({ name: 'DuplicateBarcodeError', productId: 'existing' });
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(db.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('TRIM(v.barcode) IN (?)'), ['0123456789']);
  });

  test('checks all catalog records including archived products and variants', async () => {
    await repository.findExistingBarcode('0123456789');
    const query = db.getFirstAsync.mock.calls[0][0];
    expect(query).toContain('WHERE TRIM(v.barcode) IN (?) ORDER BY');
  });

  test('rejects assigning an existing barcode to another variant', async () => {
    db.getFirstAsync.mockResolvedValue({ product_id: 'existing', product_name: 'Water' });
    await expect(repository.addVariant('another', { label: 'Bottle', price_minor: 100, barcode: '0123456789' }))
      .rejects.toBeInstanceOf(DuplicateBarcodeError);
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('allows products without a barcode', async () => {
    await repository.create({ name: 'Loose item', price_minor: 100, barcode: '  ' });
    expect(db.getFirstAsync).not.toHaveBeenCalled();
    expect(db.runAsync).toHaveBeenCalledTimes(2);
  });

  test('allows a new barcode and preserves its leading zero', async () => {
    const result = await repository.create({ name: 'Water', price_minor: 100, barcode: ' 0123456789 ' });
    expect(result.variants[0].barcode).toBe('0123456789');
    expect(db.runAsync).toHaveBeenCalledTimes(2);
  });
});
