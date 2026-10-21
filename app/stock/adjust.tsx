import React, { useState, useEffect, useCallback } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { stockRepository } from '../../src/db/repositories/stock.repository';
import { ProductWithDetails, ProductVariant, StockMovementType } from '../../src/types';
import { StockBadge } from '../../src/components/StockBadge';
import { SearchBar } from '../../src/components/SearchBar';

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

  // Form state
  const [movementType, setMovementType] = useState<StockMovementType>('RESTOCK');
  const [quantityInput, setQuantityInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
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
      } else if (allProducts.length > 0) {
        setSelectedProduct(allProducts[0]);
        setSelectedVariant(allProducts[0].variants[0] || null);
      }
    } catch (err) {
      console.error('Failed to load products for stock adjustment:', err);
    } finally {
      setLoading(false);
    }
  }, [params.productId, params.variantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectVariant = (prod: ProductWithDetails, variant: ProductVariant) => {
    setSelectedProduct(prod);
    setSelectedVariant(variant);
    setShowPicker(false);
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

    if (!reasonInput.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason or explanation for this stock movement.');
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
                reason: reasonInput.trim(),
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
      p.variants.some((v) => v.label.toLowerCase().includes(search.toLowerCase()) || v.sku?.toLowerCase().includes(search.toLowerCase()))
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
      <TouchableOpacity
        style={styles.selectorCard}
        onPress={() => setShowPicker(!showPicker)}
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
            placeholder="Filter products..."
          />
          <ScrollView style={styles.pickerList} nestedScrollEnabled>
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
              onPress={() => setMovementType(item.type)}
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
        <TextInput
          style={styles.input}
          placeholder="e.g. 12"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          value={quantityInput}
          onChangeText={setQuantityInput}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Required Reason / Audit Note *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="State the reason for this adjustment (e.g. Broken bottle during restocking, Supplier batch received)"
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
          value={reasonInput}
          onChangeText={setReasonInput}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleCommitAdjustment}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Commit Stock Adjustment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
