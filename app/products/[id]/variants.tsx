import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../../src/db/repositories/products.repository';
import { ProductWithDetails, ProductVariant } from '../../../src/types';
import { MoneyText } from '../../../src/components/MoneyText';
import { StockBadge } from '../../../src/components/StockBadge';
import { parseMoneyToMinor, minorToDecimalString } from '../../../src/utils/currency';

export default function VariantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Variant Add/Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [label, setLabel] = useState('');
  const [unitLabel, setUnitLabel] = useState('piece');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [threshold, setThreshold] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await productsRepository.getByIdWithDetails(id);
      setProduct(data);
    } catch (err) {
      console.error('Failed to load variants:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const handleOpenAdd = () => {
    setEditingVariant(null);
    setLabel('');
    setUnitLabel(product?.variants[0]?.unit_label || 'piece');
    setPrice(product?.primary_price_minor ? minorToDecimalString(product.primary_price_minor) : '');
    setCost('');
    setInitialStock('0');
    setSku('');
    setBarcode('');
    setThreshold('');
    setModalVisible(true);
  };

  const handleSaveVariant = async () => {
    if (!product || !label.trim()) {
      Alert.alert('Validation Error', 'Variant label is required.');
      return;
    }

    const priceMinor = parseMoneyToMinor(price);
    if (priceMinor <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid selling price greater than 0.');
      return;
    }

    const costMinor = cost.trim() ? parseMoneyToMinor(cost) : null;
    const initialQty = parseInt(initialStock, 10) || 0;
    const lowStock = threshold.trim() ? parseInt(threshold, 10) : null;

    try {
      await productsRepository.addVariant(product.id, {
        label: label.trim(),
        unit_label: unitLabel.trim() || 'piece',
        price_minor: priceMinor,
        cost_minor: costMinor,
        initial_stock: initialQty,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        low_stock_threshold: lowStock,
      });

      setModalVisible(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save variant.');
    }
  };

  if (loading || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Product Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.subtext}>
            {product.variants.length} {product.variants.length === 1 ? 'variant' : 'variants'} • Total Stock: {product.total_stock}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Variant</Text>
        </TouchableOpacity>
      </View>

      {/* Variants List */}
      <FlatList
        data={product.variants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.variantLabel}>{item.label}</Text>
              <MoneyText amountMinor={item.price_minor} style={styles.price} />
            </View>

            <View style={styles.badgeRow}>
              <StockBadge
                quantity={item.stock_quantity}
                lowStockThreshold={item.low_stock_threshold}
                unitLabel={item.unit_label}
              />
              {item.cost_minor !== null && (
                <Text style={styles.costText}>
                  Cost: <MoneyText amountMinor={item.cost_minor} />
                </Text>
              )}
            </View>

            <View style={styles.metaRow}>
              {item.sku && <Text style={styles.metaItem}>SKU: {item.sku}</Text>}
              {item.barcode && <Text style={styles.metaItem}>Barcode: {item.barcode}</Text>}
              {item.low_stock_threshold !== null && (
                <Text style={styles.metaItem}>Alert at: ≤{item.low_stock_threshold}</Text>
              )}
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => router.push(`/stock/adjust?productId=${product.id}&variantId=${item.id}`)}
              >
                <Ionicons name="swap-vertical" size={14} color="#2563EB" />
                <Text style={styles.adjustBtnText}>Adjust Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Add Variant Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Stock-Bearing Variant</Text>

            <Text style={styles.modalLabel}>Variant Option / Label *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500ml, XL, Red, 6-Pack"
              placeholderTextColor="#94A3B8"
              value={label}
              onChangeText={setLabel}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Selling Price (₱) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Purchase Cost (₱)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={cost}
                  onChangeText={setCost}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Initial Stock</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={initialStock}
                  onChangeText={setInitialStock}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Unit Label</Text>
                <TextInput
                  style={styles.input}
                  placeholder="piece, bottle, kg"
                  placeholderTextColor="#94A3B8"
                  value={unitLabel}
                  onChangeText={setUnitLabel}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>SKU</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor="#94A3B8"
                  value={sku}
                  onChangeText={setSku}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Low Stock Alert</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Threshold (e.g. 5)"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={threshold}
                  onChangeText={setThreshold}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveVariant}>
                <Text style={styles.saveBtnText}>Save Variant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  costText: {
    fontSize: 12,
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  metaItem: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  adjustBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
    color: '#0F172A',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
