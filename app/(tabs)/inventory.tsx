import { useLabels } from '../../src/store/PreferencesProvider';
import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import { ExpirationFilter, matchesExpirationFilter } from '../../src/utils/expiration';
import { useLocalDate } from '../../src/utils/useLocalDate';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { categoriesRepository } from '../../src/db/repositories/categories.repository';
import { ProductWithDetails, Category, EntityStatus } from '../../src/types';
import { SearchBar } from '../../src/components/SearchBar';
import { ProductCard } from '../../src/components/ProductCard';
import { EmptyState } from '../../src/components/EmptyState';
import { Alert } from 'react-native';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { lookupProductByBarcodeOnline } from '../../src/services/productLookup.service';

export default function InventoryScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const { t } = useLabels();
  const now = useLocalDate();
  const [expirationFilter, setExpirationFilter] = useState<ExpirationFilter | null>(null);
  const params = useLocalSearchParams<{ lowStock?: string; expiration?: 'soon' | 'expired' }>();
  useEffect(() => { setExpirationFilter(params.expiration === 'soon' || params.expiration === 'expired' ? params.expiration : null); }, [params.expiration]);
  const [lowStockOnly, setLowStockOnly] = useState(params.lowStock === '1');
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EntityStatus>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  useEffect(() => {
    setLowStockOnly(params.lowStock === '1');
    if (params.lowStock === '1') {
      setExpirationFilter(null);
      setSelectedCategoryId(null); setStatusFilter('ACTIVE'); setSearch('');
    }
  }, [params.lowStock]);

  const handleBarcodeScanned = async (code: string) => {
    try {
      const match = await productsRepository.findByBarcodeOrSku(code);
      if (match) {
        router.push(`/products/${match.product.id}`);
      } else {
        setScannerOpen(false);
        const online = await lookupProductByBarcodeOnline(code, 3500);
        if (online) {
          Alert.alert(
            'Product Identified Online!',
            `"${online.name}" (${online.brand || 'No brand'})\n\nAdd this product with its online details? You can choose the photo before saving.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add Product',
                onPress: () =>
                  router.push(`/products/new?barcode=${encodeURIComponent(code)}&lookup=1`),
              },
            ]
          );
        } else {
          Alert.alert(
            'Barcode Not Found',
            `No product matches barcode "${code}". Would you like to create a new product with this barcode?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add Product',
                onPress: () => router.push(`/products/new?barcode=${encodeURIComponent(code)}`),
              },
            ]
          );
        }
      }
    } catch (err) {
      console.error('Failed to lookup barcode in inventory:', err);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([
        categoriesRepository.getAll(),
        productsRepository.getAllWithDetails({
          search,
          categoryId: selectedCategoryId,
          status: statusFilter,
        }),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategoryId, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const visibleProducts = products.filter(product => {
    const lowStockMatches = !lowStockOnly || product.variants.some(variant =>
      variant.status === 'ACTIVE' && variant.low_stock_threshold !== null && variant.stock_quantity <= variant.low_stock_threshold);
    return lowStockMatches && (!expirationFilter || product.variants.some(variant => matchesExpirationFilter(variant, expirationFilter, now)));
  });
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, SKU, or barcode..." />
          </View>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setScannerOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="barcode-outline" size={22} color={colors.onAccent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category filter scroll */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
          <TouchableOpacity
            style={[styles.chip, selectedCategoryId === null && !lowStockOnly && !expirationFilter && styles.chipActive]}
            onPress={() => { setExpirationFilter(null); setSelectedCategoryId(null); setLowStockOnly(false); router.setParams({ lowStock: undefined, expiration: undefined }); }}
          >
            <Text style={[styles.chipText, selectedCategoryId === null && !lowStockOnly && !expirationFilter && styles.chipTextActive]}>
              {t('all')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.chip, lowStockOnly && styles.chipActive]} onPress={() => { setLowStockOnly(!lowStockOnly); router.setParams({ lowStock: lowStockOnly ? undefined : '1' }); }} accessibilityRole="button" accessibilityState={{ selected: lowStockOnly }}>
            <Text style={[styles.chipText, lowStockOnly && styles.chipTextActive]}>{t('lowStock')}</Text>
          </TouchableOpacity>
          {(['soon', 'expired'] as const).map(filter => (
            <TouchableOpacity key={filter} accessibilityRole="button" accessibilityState={{ selected: expirationFilter === filter }}
              style={[styles.chip, expirationFilter === filter && styles.chipActive]}
              onPress={() => setExpirationFilter(expirationFilter === filter ? null : filter)}>
              <Text style={[styles.chipText, expirationFilter === filter && styles.chipTextActive]}>{filter === 'soon' ? t('soon') : t('expired')}</Text>
            </TouchableOpacity>
          ))}
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, selectedCategoryId === cat.id && styles.chipActive]}
              onPress={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
            >
              <Text style={[styles.chipText, selectedCategoryId === cat.id && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Status Toggle (Active / Archived) */}
      <View style={styles.statusBar}>
        <View style={styles.statusToggle}>
          <TouchableOpacity
            style={[styles.statusOption, statusFilter === 'ACTIVE' && styles.statusOptionActive]}
            onPress={() => setStatusFilter('ACTIVE')}
          >
            <Text style={[styles.statusOptionText, statusFilter === 'ACTIVE' && styles.statusOptionTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusOption, statusFilter === 'ARCHIVED' && styles.statusOptionActive]}
            onPress={() => setStatusFilter('ARCHIVED')}
          >
            <Text style={[styles.statusOptionText, statusFilter === 'ARCHIVED' && styles.statusOptionTextActive]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.itemCount}>
          {visibleProducts.length} {visibleProducts.length === 1 ? 'item' : 'items'}
        </Text>
      </View>

      <TouchableOpacity onPress={() => router.push('/products/new')} style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
        <Text style={{ color: colors.accent, fontSize: 14 }}>+ Add product manually</Text>
      </TouchableOpacity>
      {/* Product List */}
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/products/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title={expirationFilter ? 'No Matching Expiration Dates' : lowStockOnly ? 'No Low Stock Items' : statusFilter === 'ARCHIVED' ? 'No Archived Products' : 'No Products Found'}
              description={
                expirationFilter ? 'No stocked items match this expiration filter and your other filters.' : lowStockOnly ? 'Your current products are above their stock limits.' : search
                  ? `No matching items found for "${search}".`
                  : 'Get started by creating your first product in your inventory.'
              }
              actionLabel={statusFilter === 'ACTIVE' && !search && !lowStockOnly && !expirationFilter ? 'Add Product' : undefined}
              onAction={() => router.push('/products/new')}
            />
          ) : undefined
        }
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Barcode to View Product"
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.paper,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    backgroundColor: colors.accent,
    width: 44,
    height: 44,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 0,
  },
  categoriesContainer: {
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 10,
  },
  categoryChips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.onAccent,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusToggle: {
    flexDirection: 'row',
    backgroundColor: colors.line,
    borderRadius: 8,
    padding: 2,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusOptionActive: {
    backgroundColor: colors.paper,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  statusOptionTextActive: {
    color: colors.ink,
  },
  itemCount: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 88,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 0,
  },
});
