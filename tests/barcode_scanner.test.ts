describe('Offline Barcode Identification & Matching Tests', () => {
  interface MockProduct {
    id: string;
    name: string;
    status: 'ACTIVE' | 'ARCHIVED';
  }

  interface MockVariant {
    id: string;
    product_id: string;
    label: string;
    sku: string | null;
    barcode: string | null;
    price_minor: number;
    stock_quantity: number;
    status: 'ACTIVE' | 'ARCHIVED';
  }

  let products: MockProduct[] = [];
  let variants: MockVariant[] = [];

  beforeEach(() => {
    products = [
      { id: 'p1', name: 'San Miguel Pale Pilsen 330ml', status: 'ACTIVE' },
      { id: 'p2', name: 'Universal USB-C Cable', status: 'ACTIVE' },
      { id: 'p3', name: 'Discontinued Snack', status: 'ARCHIVED' },
    ];

    variants = [
      {
        id: 'v1',
        product_id: 'p1',
        label: 'Single Bottle',
        sku: 'BEV-001-SGL',
        barcode: '4800012345678', // standard 13-digit EAN
        price_minor: 6500,
        stock_quantity: 48,
        status: 'ACTIVE',
      },
      {
        id: 'v2',
        product_id: 'p1',
        label: '6-Pack Box',
        sku: 'BEV-001-6PK',
        barcode: '4800012345685',
        price_minor: 38000,
        stock_quantity: 10,
        status: 'ACTIVE',
      },
      {
        id: 'v3',
        product_id: 'p2',
        label: '1 Meter Black',
        sku: 'ACC-USB-01',
        barcode: '712345678901', // 12-digit UPC-A
        price_minor: 15000,
        stock_quantity: 15,
        status: 'ACTIVE',
      },
      {
        id: 'v4',
        product_id: 'p3',
        label: 'Original',
        sku: 'OLD-001',
        barcode: '9999999999999',
        price_minor: 2500,
        stock_quantity: 0,
        status: 'ARCHIVED',
      },
    ];
  });

  // Mirroring ProductsRepository.findByBarcodeOrSku logic
  function findByBarcodeOrSku(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return null;

    const variant = variants.find(
      (v) => (v.barcode === trimmed || v.sku === trimmed) && v.status === 'ACTIVE'
    );
    if (!variant) return null;

    const product = products.find((p) => p.id === variant.product_id && p.status === 'ACTIVE');
    if (!product) return null;

    return { product, variant };
  }

  it('correctly matches item by 13-digit EAN barcode', () => {
    const match = findByBarcodeOrSku('4800012345678');
    expect(match).not.toBeNull();
    expect(match?.product.name).toBe('San Miguel Pale Pilsen 330ml');
    expect(match?.variant.label).toBe('Single Bottle');
    expect(match?.variant.price_minor).toBe(6500);
    expect(match?.variant.stock_quantity).toBe(48);
  });

  it('differentiates multiple variants of the same product by distinct barcodes', () => {
    const single = findByBarcodeOrSku('4800012345678');
    const pack = findByBarcodeOrSku('4800012345685');

    expect(single?.variant.label).toBe('Single Bottle');
    expect(pack?.variant.label).toBe('6-Pack Box');
    expect(single?.product.id).toBe(pack?.product.id);
  });

  it('matches item by SKU code when barcode is not provided', () => {
    const match = findByBarcodeOrSku('ACC-USB-01');
    expect(match).not.toBeNull();
    expect(match?.product.name).toBe('Universal USB-C Cable');
    expect(match?.variant.barcode).toBe('712345678901');
  });

  it('returns null when barcode is unregistered', () => {
    const match = findByBarcodeOrSku('0000000000000');
    expect(match).toBeNull();
  });

  it('ignores archived/inactive products when scanning barcode', () => {
    const match = findByBarcodeOrSku('9999999999999');
    expect(match).toBeNull();
  });

  it('handles surrounding whitespace gracefully when scanned', () => {
    const match = findByBarcodeOrSku('   4800012345678  \n');
    expect(match).not.toBeNull();
    expect(match?.variant.id).toBe('v1');
  });

  it('returns null for empty or whitespace-only barcode input', () => {
    expect(findByBarcodeOrSku('')).toBeNull();
    expect(findByBarcodeOrSku('   ')).toBeNull();
  });
});
