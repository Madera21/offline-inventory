import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EntityStatus>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

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
            <Ionicons name="barcode-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category filter scroll */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
          <TouchableOpacity
            style={[styles.chip, selectedCategoryId === null && styles.chipActive]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text style={[styles.chipText, selectedCategoryId === null && styles.chipTextActive]}>
              All
            </Text>
          </TouchableOpacity>

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
          {products.length} {products.length === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {/* Product List */}
      <FlatList
        data={products}
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
              title={statusFilter === 'ARCHIVED' ? 'No Archived Products' : 'No Products Found'}
              description={
                search
                  ? `No matching items found for "${search}".`
                  : 'Get started by creating your first product in your inventory.'
              }
              actionLabel={statusFilter === 'ACTIVE' && !search ? 'Add Product' : undefined}
              onAction={() => router.push('/products/new')}
            />
          ) : undefined
        }
      />

      {/* Floating Action Button */}
      {statusFilter === 'ACTIVE' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/products/new')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    backgroundColor: '#0284C7',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  categoryChips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusOptionTextActive: {
    color: '#0F172A',
  },
  itemCount: {
    fontSize: 13,
    color: '#64748B',
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
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
