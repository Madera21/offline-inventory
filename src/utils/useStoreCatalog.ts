import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { productsRepository } from '../db/repositories/products.repository';
import { ProductWithDetails } from '../types';

export function useStoreCatalog() {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setProducts(await productsRepository.getAllWithDetails({ status: 'ACTIVE' })); setError(''); }
    catch { setError('Could not load products. Tap Refresh to try again.'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const variants = products.flatMap(product => product.variants.map(variant => ({ ...variant, product_name: product.name })));
  return { products, variants, load, error };
}
