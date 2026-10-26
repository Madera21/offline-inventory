import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import { ExpirationDateField } from '../../src/components/ExpirationDateField';
import { ExpirationBadge } from '../../src/components/ExpirationBadge';
import { ExpirationDateEditor } from '../../src/components/ExpirationDateEditor';
import { VariantSettings } from '../../src/components/VariantSettings';
import { StoreButton } from '../../src/components/StoreForm';
import { storeRepository } from '../../src/db/repositories/store.repository';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { stockRepository } from '../../src/db/repositories/stock.repository';
import { ProductWithDetails, ProductVariant, StockMovementType } from '../../src/types';
import { resolveImageUri } from '../../src/services/image.service';
import { MoneyText } from '../../src/components/MoneyText';
import { StockBadge } from '../../src/components/StockBadge';
import { formatDateTime } from '../../src/utils/dates';
import { parseMoneyToMinor } from '../../src/utils/currency';
import { FramedProductImage } from '../../src/components/FramedProductImage';
import { ImageFrameEditor } from '../../src/components/ImageFrameEditor';
import { readImageFrame } from '../../src/utils/imageFrame';
import { StockReasonPicker, MANUAL_STOCK_REASON } from '../../src/components/StockReasonPicker';

export default function ProductDetailsScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [variantExpirationDate, setVariantExpirationDate] = useState('');

  const [product, setProduct] = useState<ProductWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingFrame, setEditingFrame] = useState(false);

  // Stock adjust modal
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovementType>('RESTOCK');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  // Add variant modal
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [variantLabel, setVariantLabel] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantCost, setVariantCost] = useState('');
  const [variantStock, setVariantStock] = useState('0');
  const [variantSku, setVariantSku] = useState('');

  const loadProduct = useCallback(async () => {
    if (!id) return;
    try {
      const data = await productsRepository.getByIdWithDetails(id);
      setProduct(data);
    } catch (err) {
      console.error('Failed to load product details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProduct();
    setRefreshing(false);
  };

  const handleOpenAdjust = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setAdjustType('RESTOCK');
    setAdjustQuantity('');
    setAdjustReason('');
    setSelectedReason(null);
    setAdjustModalVisible(true);
  };

  const handleSaveAdjust = async () => {
    if (!selectedVariant) return;
    const reason = selectedReason === MANUAL_STOCK_REASON ? adjustReason.trim() : selectedReason;
    if (!reason) {
      Alert.alert('Reason Required', selectedReason === MANUAL_STOCK_REASON ? 'Please write your reason.' : 'Please select a reason for this stock movement.');
      return;
    }
    const qty = parseInt(adjustQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive quantity.');
      return;
    }

    const isSubtraction = ['DAMAGE', 'SALE'].includes(adjustType);
    const delta = isSubtraction ? -qty : qty;

    try {
      await stockRepository.recordMovement({
        variantId: selectedVariant.id,
        movementType: adjustType,
        quantityDelta: delta,
        reason,
      });

      setAdjustModalVisible(false);
      await loadProduct();
    } catch (err: any) {
      Alert.alert('Adjustment Error', err?.message || 'Failed to adjust stock.');
    }
  };

  const handleAddVariant = async () => {
    if (!product || !variantLabel.trim()) {
      Alert.alert('Validation Error', 'Variant name/label is required.');
      return;
    }

    const priceMinor = parseMoneyToMinor(variantPrice);
    if (priceMinor <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid selling price.');
      return;
    }

    const costMinor = variantCost.trim() ? parseMoneyToMinor(variantCost) : null;
    const initialStock = parseInt(variantStock, 10) || 0;

    try {
      await productsRepository.addVariant(product.id, {
        label: variantLabel.trim(),
        price_minor: priceMinor,
        cost_minor: costMinor,
        initial_stock: initialStock,
        expiration_date: variantExpirationDate,
        sku: variantSku.trim() || null,
      });

      setVariantModalVisible(false);
      setVariantLabel('');
      setVariantPrice('');
      setVariantCost('');
      setVariantStock('0');
      setVariantSku('');
      setVariantExpirationDate('');
      await loadProduct();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add variant.');
    }
  };

  const handleToggleArchive = async () => {
    if (!product) return;
    const isArchived = product.status === 'ARCHIVED';
    const actionText = isArchived ? 'restore' : 'archive';

    Alert.alert(
      `${isArchived ? 'Restore' : 'Archive'} Product`,
      `Are you sure you want to ${actionText} "${product.name}"? Historical sales records will remain preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isArchived ? 'Restore' : 'Archive',
          style: isArchived ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (isArchived) {
                await productsRepository.restore(product.id);
              } else {
                await productsRepository.archive(product.id);
              }
              await loadProduct();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to update status.');
            }
          },
        },
      ]
    );
  };

  if (loading || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const primaryVariant = product.variants[0];
  const firstImage = product.images[0]?.relative_path;
  const imageUri = resolveImageUri(firstImage);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Product Hero */}
      <View style={styles.heroCard}>
        {imageUri ? (
          <View>
            <FramedProductImage uri={imageUri} frame={readImageFrame(product.images[0]?.frame_json)} style={styles.heroImage} />
            <TouchableOpacity onPress={() => setEditingFrame(true)} style={{ padding: 12 }}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Edit Framing</Text>
            </TouchableOpacity>
            {editingFrame && <ImageFrameEditor uri={imageUri} initialFrame={readImageFrame(product.images[0]?.frame_json)} onClose={() => setEditingFrame(false)} onSave={async (frame) => {
              await productsRepository.updateImageFrame(product.images[0].id, JSON.stringify(frame));
              await loadProduct();
            }} />}
          </View>
        ) : (
          <View style={styles.placeholderHero}>
            <Ionicons name="cube-outline" size={48} color={colors.muted} />
          </View>
        )}

        <View style={styles.heroDetails}>
          <View style={styles.badgeRow}>
            {product.category_name && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{product.category_name}</Text>
              </View>
            )}
            {product.brand && <Text style={styles.brandText}>{product.brand}</Text>}
            {product.status === 'ARCHIVED' && (
              <View style={styles.archivedBadge}>
                <Text style={styles.archivedBadgeText}>ARCHIVED</Text>
              </View>
            )}
          </View>

          <Text style={styles.productName}>{product.name}</Text>

          <View style={styles.heroPriceRow}>
            <MoneyText amountMinor={product.primary_price_minor} style={styles.heroPrice} />
            <StockBadge
              quantity={product.total_stock}
              lowStockThreshold={primaryVariant?.low_stock_threshold}
              unitLabel={primaryVariant?.unit_label ?? 'units'}
            />
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleOpenAdjust(primaryVariant)}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-vertical" size={18} color={colors.accent} />
          <Text style={styles.actionBtnText}>Adjust Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/products/${product.id}/edit`)}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.ink} />
          <Text style={[styles.actionBtnText, { color: colors.ink }]}>Edit Info</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleToggleArchive}
          activeOpacity={0.8}
        >
          <Ionicons
            name={product.status === 'ACTIVE' ? 'archive-outline' : 'refresh-outline'}
            size={18}
            color={product.status === 'ACTIVE' ? colors.danger : colors.success}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: product.status === 'ACTIVE' ? colors.danger : colors.success },
            ]}
          >
            {product.status === 'ACTIVE' ? 'Archive' : 'Restore'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Variants Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Variants & Stock ({product.variants.length})</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={styles.addVariantLink}
            onPress={() => router.push(`/products/${product.id}/variants`)}
          >
            <Ionicons name="list-outline" size={16} color={colors.accent} />
            <Text style={styles.addVariantText}>Manage</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addVariantLink}
            onPress={() => setVariantModalVisible(true)}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addVariantText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {product.variants.map((v) => (
        <View key={v.id} style={styles.variantCard}>
          <View style={styles.variantHeader}>
            <Text style={styles.variantLabel}>{v.label}</Text>
            <MoneyText amountMinor={v.price_minor} style={styles.variantPrice} />
          </View>

          <ExpirationBadge date={v.expiration_date} />
          <ExpirationDateEditor variant={v} onSaved={loadProduct} />
            <VariantSettings variant={v} onSaved={loadProduct} />
            <StoreButton secondary label="Batches" onPress={() => router.push(`/stock/batches?variantId=${v.id}`)} />
            <StoreButton secondary label={v.favorite ? 'Unpin favorite' : 'Pin favorite'} onPress={async () => {
              try { await storeRepository.favorite(v.id, !v.favorite); await loadProduct(); }
              catch { Alert.alert('Could not save favorite', 'Please try again.'); }
            }} />
          <View style={styles.variantMeta}>
            <Text style={styles.variantMetaText}>
              Stock: {v.stock_quantity} {v.unit_label}
            </Text>
            {v.cost_minor !== null && (
              <Text style={styles.variantMetaText}>
                Cost: <MoneyText amountMinor={v.cost_minor} />
              </Text>
            )}
            {v.sku && <Text style={styles.variantMetaText}>SKU: {v.sku}</Text>}
          </View>

          <TouchableOpacity
            style={styles.adjustVariantBtn}
            onPress={() => handleOpenAdjust(v)}
          >
            <Ionicons name="sync-outline" size={14} color={colors.accent} />
            <Text style={styles.adjustVariantBtnText}>Adjust Quantity</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Metadata / Details */}
      <Text style={styles.sectionHeader}>Details</Text>
      <View style={styles.detailsCard}>
        {product.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailValue}>{product.description}</Text>
          </View>
        )}
        {product.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Notes</Text>
            <Text style={styles.detailValue}>{product.notes}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{formatDateTime(product.created_at)}</Text>
        </View>
        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>Last Updated</Text>
          <Text style={styles.detailValue}>{formatDateTime(product.updated_at)}</Text>
        </View>
      </View>

      {/* Adjust Stock Modal */}
      <Modal visible={adjustModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Adjust Stock: {selectedVariant?.label}
            </Text>
            <Text style={styles.modalSubtitle}>
              Current balance: {selectedVariant?.stock_quantity} {selectedVariant?.unit_label}
            </Text>

            <Text style={styles.modalLabel}>Movement Type</Text>
            <View style={styles.typeSelector}>
              {(['RESTOCK', 'DAMAGE', 'ADJUSTMENT'] as StockMovementType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeButton, adjustType === t && styles.typeButtonActive]}
                  onPress={() => {
                    if (adjustType !== t) {
                      setAdjustType(t);
                      setSelectedReason(null);
                      setAdjustReason('');
                    }
                  }}
                >
                  <Text style={[styles.typeButtonText, adjustType === t && styles.typeButtonTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Quantity ({adjustType === 'DAMAGE' ? 'Units to remove' : 'Units to add'})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 10"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={adjustQuantity}
              onChangeText={setAdjustQuantity}
            />

            <Text style={styles.modalLabel}>Reason *</Text>
            <StockReasonPicker
              movementType={adjustType}
              selectedReason={selectedReason}
              manualReason={adjustReason}
              onSelect={setSelectedReason}
              onManualChange={setAdjustReason}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setAdjustModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSaveAdjust}>
                <Text style={styles.modalConfirmText}>Save Movement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Variant Modal */}
      <Modal visible={variantModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" style={[styles.modalContent, { flexGrow: 0, maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Add Product Variant</Text>
            <ExpirationDateField value={variantExpirationDate} onChangeText={setVariantExpirationDate} />

            <Text style={styles.modalLabel}>Variant Label *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Large / 1.5L / Red"
              placeholderTextColor={colors.muted}
              value={variantLabel}
              onChangeText={setVariantLabel}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Price (₱) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={variantPrice}
                  onChangeText={setVariantPrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Cost (₱)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Optional"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={variantCost}
                  onChangeText={setVariantCost}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Initial Stock</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={variantStock}
                  onChangeText={setVariantStock}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>SKU</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Optional"
                  placeholderTextColor={colors.muted}
                  value={variantSku}
                  onChangeText={setVariantSku}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setVariantModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddVariant}>
                <Text style={styles.modalConfirmText}>Add Variant</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
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
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  placeholderHero: {
    width: '100%',
    height: 140,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDetails: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  brandText: {
    fontSize: 13,
    color: colors.muted,
  },
  archivedBadge: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  archivedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.danger,
  },
  productName: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 10,
  },
  heroPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPrice: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.accent,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addVariantLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addVariantText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  variantCard: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  variantPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.accent,
  },
  variantMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  variantMetaText: {
    fontSize: 12,
    color: colors.muted,
  },
  adjustVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  adjustVariantBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.soft,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
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
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginBottom: 14,
    color: colors.ink,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  typeButtonTextActive: {
    color: colors.accent,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalCancelText: {
    color: colors.muted,
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: colors.onAccent,
    fontWeight: '600',
  },
});
