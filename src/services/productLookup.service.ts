export interface OnlineProductLookupResult {
  barcode: string;
  name: string;
  brand: string | null;
  categoryName: string | null;
  unitLabel: string;
  description: string | null;
  imageUrl: string | null;
  source: string;
}

/**
 * Infers an appropriate base unit label (e.g. bottle, can, pack, piece)
 * from product quantity or title.
 */
function inferUnitLabel(name: string, quantity?: string): string {
  const combined = `${name} ${quantity || ''}`.toLowerCase();
  if (/\b(can|cans|tin|tins)\b/i.test(combined)) return 'can';
  if (/\b(bottle|bottles|bot)\b/i.test(combined)) return 'bottle';
  if (/\b(pack|packs|pk|pouch|sachet|bag)\b/i.test(combined)) return 'pack';
  if (/\b(box|boxes|carton|case)\b/i.test(combined)) return 'box';
  if (/\b(roll|rolls)\b/i.test(combined)) return 'roll';
  if (/\b(kg|kilo|kilograms?)\b/i.test(combined)) return 'kg';
  if (/\b(grams?)\b/i.test(combined)) return 'g';
  if (/\b(ml|cl|liters?|litres?|l)\b/i.test(combined)) return 'bottle';
  return 'piece';
}

/**
 * Clean and normalize a category string
 */
function cleanCategory(categoriesStr?: string): string | null {
  if (!categoriesStr) return null;
  const parts = categoriesStr.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // Return the most specific or readable category name
  const last = parts[parts.length - 1];
  // Remove prefixes like "en:", "es:", "pt:"
  return last.replace(/^[a-z]{2}:/i, '').trim();
}

/**
 * Looks up product information on online open barcode databases (Open Food Facts,
 * Open Products Facts, Open Beauty Facts, and Google Books ISBN).
 * Returns structured metadata or null if not found or network is unavailable.
 */
export async function lookupProductByBarcodeOnline(
  barcode: string,
  timeoutMs = 5000
): Promise<OnlineProductLookupResult | null> {
  const cleanedCode = barcode.trim().replace(/[^0-9A-Za-z]/g, '');
  if (!cleanedCode || cleanedCode.length < 6) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Try Open Food Facts (groceries, snacks, beverages, pantry items)
    const foodUrl = `https://world.openfoodfacts.org/api/v0/product/${cleanedCode}.json`;
    const foodRes = await fetch(foodUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OfflineInventoryPOS - Android Mobile App' },
    });

    if (foodRes.ok) {
      const foodData = await foodRes.json();
      if (foodData && foodData.status === 1 && foodData.product) {
        clearTimeout(timer);
        const p = foodData.product;
        const name = p.product_name || p.product_name_en || p.generic_name || '';
        if (name.trim()) {
          const brand = p.brands ? p.brands.split(',')[0].trim() : null;
          const category = cleanCategory(p.categories);
          const unit = inferUnitLabel(name, p.quantity);
          const imageUrl = p.image_front_url || p.image_url || null;
          const desc = [
            p.generic_name,
            p.quantity ? `Size: ${p.quantity}` : null,
            p.serving_size ? `Serving: ${p.serving_size}` : null,
          ].filter(Boolean).join(' • ');

          return {
            barcode: cleanedCode,
            name: name.trim(),
            brand,
            categoryName: category,
            unitLabel: unit,
            description: desc || null,
            imageUrl,
            source: 'Open Food Facts',
          };
        }
      }
    }

    // 2. Try Open Products Facts (electronics, home goods, hardware, stationery)
    const prodUrl = `https://world.openproductsfacts.org/api/v0/product/${cleanedCode}.json`;
    const prodRes = await fetch(prodUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OfflineInventoryPOS - Android Mobile App' },
    });

    if (prodRes.ok) {
      const prodData = await prodRes.json();
      if (prodData && prodData.status === 1 && prodData.product) {
        clearTimeout(timer);
        const p = prodData.product;
        const name = p.product_name || p.product_name_en || '';
        if (name.trim()) {
          const brand = p.brands ? p.brands.split(',')[0].trim() : null;
          const category = cleanCategory(p.categories);
          const unit = inferUnitLabel(name, p.quantity);
          const imageUrl = p.image_front_url || p.image_url || null;

          return {
            barcode: cleanedCode,
            name: name.trim(),
            brand,
            categoryName: category,
            unitLabel: unit,
            description: p.generic_name || null,
            imageUrl,
            source: 'Open Products Facts',
          };
        }
      }
    }

    // 3. Try Open Beauty Facts (cosmetics, hygiene, pharmaceuticals)
    const beautyUrl = `https://world.openbeautyfacts.org/api/v0/product/${cleanedCode}.json`;
    const beautyRes = await fetch(beautyUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OfflineInventoryPOS - Android Mobile App' },
    });

    if (beautyRes.ok) {
      const beautyData = await beautyRes.json();
      if (beautyData && beautyData.status === 1 && beautyData.product) {
        clearTimeout(timer);
        const p = beautyData.product;
        const name = p.product_name || p.product_name_en || '';
        if (name.trim()) {
          const brand = p.brands ? p.brands.split(',')[0].trim() : null;
          const category = cleanCategory(p.categories);
          const unit = inferUnitLabel(name, p.quantity);
          const imageUrl = p.image_front_url || p.image_url || null;

          return {
            barcode: cleanedCode,
            name: name.trim(),
            brand,
            categoryName: category,
            unitLabel: unit,
            description: p.generic_name || null,
            imageUrl,
            source: 'Open Beauty Facts',
          };
        }
      }
    }

    // 4. Try Google Books API if barcode has 10 or 13 digits (ISBN)
    if (cleanedCode.length === 10 || (cleanedCode.length === 13 && (cleanedCode.startsWith('978') || cleanedCode.startsWith('979')))) {
      const booksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedCode}`;
      const booksRes = await fetch(booksUrl, { signal: controller.signal });
      if (booksRes.ok) {
        const booksData = await booksRes.json();
        if (booksData && booksData.items && booksData.items.length > 0) {
          clearTimeout(timer);
          const info = booksData.items[0].volumeInfo;
          const title = info.title || '';
          if (title.trim()) {
            const authors = info.authors ? info.authors.join(', ') : null;
            const desc = info.description ? info.description.slice(0, 300) : null;
            const img = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
            const secureImg = img ? img.replace(/^http:\/\//i, 'https://') : null;

            return {
              barcode: cleanedCode,
              name: title.trim(),
              brand: authors ? `Author: ${authors}` : (info.publisher || null),
              categoryName: 'Books & Publications',
              unitLabel: 'book',
              description: desc,
              imageUrl: secureImg,
              source: 'Google Books',
            };
          }
        }
      }
    }

    clearTimeout(timer);
    return null;
  } catch (err: any) {
    clearTimeout(timer);
    // Ignore network timeouts or offline errors gracefully
    if (err.name !== 'AbortError') {
      console.warn('[ProductLookup] Online lookup error:', err?.message || err);
    }
    return null;
  }
}
