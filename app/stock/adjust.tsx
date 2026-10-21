import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { stockRepository } from '../../src/db/repositories/stock.repository';
import { ProductWithDetails, ProductVariant, StockMovementType } from '../../src/types';
import { StockBadge } from '../../src/components/StockBadge';
import { SearchBar } from '../../src/components/SearchBar';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { StockReasonPicker, MANUAL_STOCK_REASON } from '../../src/components/StockReasonPicker';

export default function StockAdjustScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string; variantId?: string }>();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Search & selector modal state
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const scanInProgress = React.useRef(false);

  // Form state
  const [movementType, setMovementType] = useState<StockMovementType>('RESTOCK');
  const [quantityInput, setQuantityInput] = useState('1');
  const [reasonInput, setReasonInput] = useState('');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const allProducts = await productsRepository.getAllWithDetails({ status: 'ACTIVE' });
      setProducts(allProducts);

      if (params.productId) {
        const prod = allProducts.find((p) => p.id === params.productId);
        if (prod) {
          setSelectedProduct(prod);
          const variant = params.variantId
            ? prod.variants.find((v) => v.id === params.variantId) || prod.variants[0]
            : prod.variants[0];
          setSelectedVariant(variant || null);
        }
      }
    } catch (err) {
      console.error('Failed to load products for stock adjustment:', err);
    } finally {
      setLoading(false);
    }
  }, [params.productId, params.variantId]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const handleSelectVariant = (prod: ProductWithDetails, variant: ProductVariant) => {
    setSelectedProduct(prod);
    setSelectedVariant(variant);
    setShowPicker(false);
  };

  const openManualSearch = () => {
    setSearch('');
    setShowPicker(true);
  };

  const openBarcodeScanner = () => {
    setShowPicker(false);
    setScannerOpen(true);
  };

  const chooseProductMethod = () => {
    Alert.alert('Find Product', 'How would you like to find the product?', [
      { text: 'Scan Barcode', onPress: openBarcodeScanner },
      { text: 'Find Manually', onPress: openManualSearch },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBarcodeScanned = async (code: string) => {
    if (scanInProgress.current) return;
    scanInProgress.current = true;
    setScannerOpen(false);
    setLookingUpBarcode(true);
    try {
      const match = await productsRepository.findByBarcodeOrSku(code);
      if (match && match.product.status === 'ACTIVE' && match.variant.status === 'ACTIVE') {
        handleSelectVariant(match.product, match.variant);
      } else {
        Alert.alert('Product Not Found', `No active product matches "${code}". Find the product manually or scan another barcode.`, [
          { text: 'Find Manually', onPress: openManualSearch },
          { text: 'Scan Again', onPress: openBarcodeScanner },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Barcode Lookup Failed', err?.message || 'Please try again or find the product manually.');
    } finally {
      scanInProgress.current = false;
      setLookingUpBarcode(false);
    }
  };

  const handleCommitAdjustment = async () => {
    if (!selectedVariant) {
      Alert.alert('Selection Required', 'Please select a product and variant to adjust.');
      return;
    }

    const qty = parseInt(quantityInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive quantity.');
      return;
    }

    const reason = selectedReason === MANUAL_STOCK_REASON ? reasonInput.trim() : selectedReason;
    if (!reason) {
      Alert.alert('Reason Required', selectedReason === MANUAL_STOCK_REASON ? 'Please write your reason.' : 'Please select a reason for this stock movement.');
      return;
    }

    const isNegative = movementType === 'DAMAGE';
    const delta = isNegative ? -qty : qty;

    Alert.alert(
      'Confirm Stock Movement',
      `Record ${movementType.replace('_', ' ')} of ${delta > 0 ? `+${delta}` : delta} ${selectedVariant.unit_label} for "${selectedProduct?.name} (${selectedVariant.label})"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Save',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              await stockRepository.recordMovement({
                variantId: selectedVariant.id,
                movementType,
                quantityDelta: delta,
                reason,
              });

              Alert.alert(
                'Stock Updated',
                `Successfully recorded movement. Current balance is now ${selectedVariant.stock_quantity + delta} ${selectedVariant.unit_label}.`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to record stock movement.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.variants.some((v) => v.label.toLowerCase().includes(search.toLowerCase()) || v.sku?.toLowerCase().includes(search.toLowerCase()) || v.barcode?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Target Product Selection */}
      <Text style={styles.sectionHeader}>Target Product & Variant</Text>
      <Text style={styles.selectorSubtitle}>How would you like to find the product?</Text>
      <View style={styles.selectionActions}>
        <TouchableOpacity style={styles.selectionAction} onPress={openBarcodeScanner} disabled={lookingUpBarcode || submitting}>
          <Ionicons name="barcode-outline" size={24} color="#2563EB" />
          <Text style={styles.selectionActionText}>Scan Barcode</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.selectionAction} onPress={openManualSearch} disabled={lookingUpBarcode || submitting}>
          <Ionicons name="search-outline" size={24} color="#2563EB" />
          <Text style={styles.selectionActionText}>Find Manually</Text>
        </TouchableOpacity>
      </View>
      {lookingUpBarcode && <ActivityIndicator style={{ marginBottom: 12 }} color="#2563EB" />}
      <TouchableOpacity
        style={styles.selectorCard}
        onPress={chooseProductMethod}
        disabled={lookingUpBarcode || submitting}
        activeOpacity={0.8}
      >
        <View style={styles.selectorInfo}>
          <Text style={styles.selectorTitle}>
            {selectedProduct ? selectedProduct.name : 'Choose a product...'}
          </Text>
          <Text style={styles.selectorSubtitle}>
            {selectedVariant ? `Variant: ${selectedVariant.label}` : 'No variant selected'}
          </Text>
        </View>
        <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#64748B" />
      </TouchableOpacity>

      {/* Inline Product/Variant Picker */}
      {showPicker && (
        <View style={styles.pickerBox}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, SKU, or barcode..."
          />
          <ScrollView style={styles.pickerList} nestedScrollEnabled>
            {!filteredProducts.some((prod) => prod.variants.length > 0) && (
              <Text style={styles.selectorSubtitle}>No products found. Try another search.</Text>
            )}
            {filteredProducts.map((prod) =>
              prod.variants.map((variant) => {
                const isSelected = selectedVariant?.id === variant.id;
                return (
                  <TouchableOpacity
                    key={variant.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => handleSelectVariant(prod, variant)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemName, isSelected && styles.pickerItemTextActive]}>
                        {prod.name}
                      </Text>
                      <Text style={styles.pickerItemSub}>
                        {variant.label} • Current: {variant.stock_quantity} {variant.unit_label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Current Balance Display */}
      {selectedVariant && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Available Balance</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue}>
              {selectedVariant.stock_quantity} {selectedVariant.unit_label}
            </Text>
            <StockBadge
              quantity={selectedVariant.stock_quantity}
              lowStockThreshold={selectedVariant.low_stock_threshold}
              unitLabel={selectedVariant.unit_label}
            />
          </View>
        </View>
      )}

      {/* Movement Type */}
      <Text style={styles.sectionHeader}>Movement Type</Text>
      <View style={styles.typeGrid}>
        {[
          { type: 'RESTOCK' as StockMovementType, label: 'Restock (+)', icon: 'add-circle-outline' as const, color: '#16A34A' },
          { type: 'DAMAGE' as StockMovementType, label: 'Damage / Defect (−)', icon: 'remove-circle-outline' as const, color: '#DC2626' },
          { type: 'CUSTOMER_RETURN' as StockMovementType, label: 'Return (+)', icon: 'arrow-undo-outline' as const, color: '#2563EB' },
          { type: 'ADJUSTMENT' as StockMovementType, label: 'Manual Count', icon: 'options-outline' as const, color: '#D97706' },
        ].map((item) => {
          const isActive = movementType === item.type;
          return (
            <TouchableOpacity
              key={item.type}
              style={[styles.typeOption, isActive && styles.typeOptionActive]}
              onPress={() => {
                if (movementType !== item.type) {
                  setMovementType(item.type);
                  setSelectedReason(null);
                  setReasonInput('');
                }
              }}
            >
              <Ionicons name={item.icon} size={20} color={isActive ? item.color : '#64748B'} />
              <Text style={[styles.typeLabel, isActive && { color: item.color, fontWeight: '700' }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quantity & Reason */}
      <Text style={styles.sectionHeader}>Movement Details</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Quantity ({movementType === 'DAMAGE' ? 'Units to Deduct' : 'Units to Add'}) *
        </Text>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={[styles.quantityButton, (submitting || (parseInt(quantityInput, 10) || 0) <= 1) && styles.submitButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            disabled={submitting || (parseInt(quantityInput, 10) || 0) <= 1}
            onPress={() => setQuantityInput((value) => String(Math.max(1, (parseInt(value, 10) || 1) - 1)))}
          >
            <Ionicons name="remove" size={22} color="#2563EB" />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.quantityInput]}
            accessibilityLabel="Quantity"
            placeholder="1"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            value={quantityInput}
            onChangeText={(value) => setQuantityInput(value.replace(/[^0-9]/g, ''))}
            editable={!submitting}
          />
          <TouchableOpacity
            style={styles.quantityButton}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            disabled={submitting}
            onPress={() => setQuantityInput((value) => String((parseInt(value, 10) || 0) + 1))}
          >
            <Ionicons name="add" size={22} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Reason *</Text>
        <StockReasonPicker
          movementType={movementType}
          selectedReason={selectedReason}
          manualReason={reasonInput}
          onSelect={setSelectedReason}
          onManualChange={setReasonInput}
          disabled={submitting}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, (submitting || lookingUpBarcode || !selectedVariant) && styles.submitButtonDisabled]}
        onPress={handleCommitAdjustment}
        disabled={submitting || lookingUpBarcode || !selectedVariant}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Commit Stock Adjustment</Text>
        )}
      </TouchableOpacity>
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product to Restock"
        enableContinuousToggle={false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#EFF6FF',
  },
  quantityInput: {
    width: 90,
    height: 46,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  selectionAction: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  selectionActionText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  selectorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  selectorInfo: {
    flex: 1,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  pickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 8,
    padding: 12,
  },
  pickerList: {
    maxHeight: 200,
    marginTop: 10,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  pickerItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  pickerItemTextActive: {
    color: '#2563EB',
  },
  pickerItemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  typeOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
