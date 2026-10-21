import { lookupProductByBarcodeOnline } from '../src/services/productLookup.service';

describe('Online Product Barcode Lookup Service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects short or invalid barcodes immediately without network requests', async () => {
    const res1 = await lookupProductByBarcodeOnline('');
    const res2 = await lookupProductByBarcodeOnline('123');
    expect(res1).toBeNull();
    expect(res2).toBeNull();
  });

  it('successfully parses and normalizes Open Food Facts product response', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'San Miguel Pale Pilsen',
          brands: 'San Miguel',
          categories: 'Beverages, Beers, Pilsners',
          quantity: '330 ml',
          image_front_url: 'https://images.openfoodfacts.org/mock-beer.jpg',
          generic_name: 'Premium Lager Beer',
        },
      }),
    });

    const result = await lookupProductByBarcodeOnline('4800016644807');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('San Miguel Pale Pilsen');
    expect(result?.brand).toBe('San Miguel');
    expect(result?.categoryName).toBe('Pilsners');
    expect(result?.unitLabel).toBe('bottle');
    expect(result?.imageUrl).toBe('https://images.openfoodfacts.org/mock-beer.jpg');
    expect(result?.source).toBe('Open Food Facts');
  });

  it('handles offline or network errors gracefully by returning null', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const result = await lookupProductByBarcodeOnline('5449000000996');
    expect(result).toBeNull();
  });

  it('handles empty or not-found status from API gracefully', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 0,
        status_verbose: 'product not found',
      }),
    });

    const result = await lookupProductByBarcodeOnline('0000000000000');
    expect(result).toBeNull();
  });
});
