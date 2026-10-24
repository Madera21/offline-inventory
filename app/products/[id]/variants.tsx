import { ThemeColors, useThemeStyles } from '../../../src/theme/ThemeProvider';
import { ExpirationDateField } from '../../../src/components/ExpirationDateField';
import { ExpirationBadge } from '../../../src/components/ExpirationBadge';
import { ExpirationDateEditor } from '../../../src/components/ExpirationDateEditor';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
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
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';

export default function VariantsScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expirationDate, setExpirationDate] = useState('');

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

  // Scanner modal state
  const [scannerOpen, setScannerOpen] = useState(false);

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
    setExpirationDate('');
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
        expiration_date: expirationDate,
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
        <ActivityIndicator size="large" color={colors.accent} />
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
          <Ionicons name="add" size={18} color={colors.onAccent} />
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

            <ExpirationBadge date={item.expiration_date} />
            <ExpirationDateEditor variant={item} onSaved={loadData} />
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
                <Ionicons name="swap-vertical" size={14} color={colors.accent} />
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
          <ScrollView keyboardShouldPersistTaps="handled" style={[styles.modalContent, { flexGrow: 0, maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Add Stock-Bearing Variant</Text>
            <ExpirationDateField value={expirationDate} onChangeText={setExpirationDate} />

            <Text style={styles.modalLabel}>Variant Option / Label *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500ml, XL, Red, 6-Pack"
              placeholderTextColor={colors.muted}
              value={label}
              onChangeText={setLabel}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Selling Price (₱) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
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
                  placeholderTextColor={colors.muted}
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
                  placeholderTextColor={colors.muted}
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
                  placeholderTextColor={colors.muted}
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
                  placeholderTextColor={colors.muted}
                  value={sku}
                  onChangeText={setSku}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithAction}>
                  <Text style={styles.modalLabel}>Barcode</Text>
                  <TouchableOpacity
                    style={styles.scanLink}
                    onPress={() => setScannerOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="barcode-outline" size={13} color={colors.accent} />
                    <Text style={styles.scanLinkText}>Scan</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.barcodeInputWrapper}>
                  <TextInput
                    style={[styles.input, styles.barcodeInput]}
                    placeholder="Optional barcode"
                    placeholderTextColor={colors.muted}
                    value={barcode}
                    onChangeText={setBarcode}
                  />
                  <TouchableOpacity
                    style={styles.barcodeIconBtn}
                    onPress={() => setScannerOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ marginBottom: 8 }}>
              <Text style={styles.modalLabel}>Low Stock Alert</Text>
              <TextInput
                style={styles.input}
                placeholder="Threshold (e.g. 5)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={threshold}
                onChangeText={setThreshold}
              />
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
          </ScrollView>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => setBarcode(code)}
        title="Scan Variant Barcode"
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  productName: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
  },
  subtext: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  price: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  costText: {
    fontSize: 13,
    color: colors.muted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.soft,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
  },
  adjustBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: 7,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 4,
  },
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scanLinkText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.accent,
  },
  barcodeInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  barcodeInput: {
    paddingRight: 36,
  },
  barcodeIconBtn: {
    position: 'absolute',
    right: 8,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    top: -6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
    color: colors.ink,
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
    color: colors.muted,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveBtnText: {
    color: colors.onAccent,
    fontWeight: '600',
  },
});
