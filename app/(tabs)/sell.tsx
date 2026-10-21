import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { salesService } from '../../src/services/sales.service';
import { ProductWithDetails, ProductVariant, PaymentMethod } from '../../src/types';
import { useCart } from '../../src/store/cart.store';
import { SearchBar } from '../../src/components/SearchBar';
import { MoneyText } from '../../src/components/MoneyText';
import { StockBadge } from '../../src/components/StockBadge';
import { resolveImageUri } from '../../src/services/image.service';
import { parseMoneyToMinor, formatMoney } from '../../src/utils/currency';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { lookupProductByBarcodeOnline } from '../../src/services/productLookup.service';

export default function QuickSaleScreen() {
  const router = useRouter();
  const cart = useCart();

  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Variant picker modal for products with multiple variants
  const [variantModalProduct, setVariantModalProduct] = useState<ProductWithDetails | null>(null);

  // Cart / Checkout drawer modal
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [cashInput, setCashInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Barcode scanner
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleBarcodeScanned = async (code: string) => {
    try {
      const match = await productsRepository.findByBarcodeOrSku(code);
      if (match) {
        const { product, variant } = match;
        if (variant.stock_quantity <= 0) {
          Alert.alert('Out of Stock', `"${product.name}" (${variant.label}) has 0 stock.`);
          return;
        }

        cart.addItem({
          variant_id: variant.id,
          product_id: product.id,
          product_name: product.name,
          variant_label: variant.label,
          unit_label: variant.unit_label,
          unit_price_minor: variant.price_minor,
          unit_cost_minor: variant.cost_minor,
          max_available_stock: variant.stock_quantity,
        });
      } else {
        setScannerOpen(false);
        const online = await lookupProductByBarcodeOnline(code, 3500);
        if (online) {
          Alert.alert(
            'Product Identified Online!',
            `"${online.name}" (${online.brand || 'No brand'})\n\nWould you like to add it to inventory with all online configs & photo?`,
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
            `No item matches barcode "${code}". Would you like to create a new product with this barcode?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Create Product',
                onPress: () => router.push(`/products/new?barcode=${encodeURIComponent(code)}`),
              },
            ]
          );
        }
      }
    } catch (err) {
      console.error('Failed to process barcode scan in quick sale:', err);
    }
  };

  // Sale success modal
  const [completedReceipt, setCompletedReceipt] = useState<{
    receiptNumber: string;
    totalMinor: number;
    changeMinor: number;
    saleId: string;
  } | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const data = await productsRepository.getAllWithDetails({
        search,
        status: 'ACTIVE',
      });
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products for quick sale:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const handleProductPress = (product: ProductWithDetails) => {
    if (product.has_multiple_variants) {
      setVariantModalProduct(product);
    } else {
      const primary = product.variants[0];
      if (!primary || primary.stock_quantity <= 0) {
        Alert.alert('Out of Stock', `"${product.name}" has no available stock.`);
        return;
      }
      cart.addItem({
        variant_id: primary.id,
        product_id: product.id,
        product_name: product.name,
        variant_label: primary.label,
        unit_label: primary.unit_label,
        unit_price_minor: primary.price_minor,
        unit_cost_minor: primary.cost_minor,
        max_available_stock: primary.stock_quantity,
      });
    }
  };

  const handleSelectVariant = (variant: ProductVariant) => {
    if (!variantModalProduct) return;
    if (variant.stock_quantity <= 0) {
      Alert.alert('Out of Stock', `Variant "${variant.label}" has no available stock.`);
      return;
    }

    cart.addItem({
      variant_id: variant.id,
      product_id: variantModalProduct.id,
      product_name: variantModalProduct.name,
      variant_label: variant.label,
      unit_label: variant.unit_label,
      unit_price_minor: variant.price_minor,
      unit_cost_minor: variant.cost_minor,
      max_available_stock: variant.stock_quantity,
    });
    setVariantModalProduct(null);
  };

  const handleDiscountChange = (text: string) => {
    setDiscountInput(text);
    const minor = parseMoneyToMinor(text);
    cart.setDiscount(minor);
  };

  const handleCashChange = (text: string) => {
    setCashInput(text);
    const minor = text.trim() ? parseMoneyToMinor(text) : null;
    cart.setCashReceived(minor);
  };

  const handleCommitSale = async () => {
    if (cart.items.length === 0) return;

    if (cart.paymentMethod === 'CASH' && cart.cashReceivedMinor !== null) {
      if (cart.cashReceivedMinor < cart.totalMinor) {
        Alert.alert(
          'Insufficient Cash',
          `Received amount (${formatMoney(cart.cashReceivedMinor)}) is less than total (${formatMoney(cart.totalMinor)}).`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await salesService.commitSale({
        items: cart.items,
        discountMinor: cart.discountMinor,
        paymentMethod: cart.paymentMethod,
      });

      const changeMinor = cart.changeMinor;
      cart.clear();
      setDiscountInput('');
      setCashInput('');
      setCartModalVisible(false);

      setCompletedReceipt({
        receiptNumber: result.receipt_number,
        totalMinor: result.total_minor,
        changeMinor,
        saleId: result.id,
      });

      await loadProducts();
    } catch (err: any) {
      Alert.alert('Checkout Error', err?.message || 'Failed to complete sale.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search product, SKU or barcode..." />
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

      {/* Product Catalog Grid */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const firstImage = item.images[0]?.relative_path;
          const imageUri = resolveImageUri(firstImage);
          const inCartCount = cart.items
            .filter((i) => i.product_id === item.id)
            .reduce((sum, i) => sum + i.quantity, 0);

          return (
            <TouchableOpacity
              style={[styles.productCard, item.total_stock <= 0 && styles.productCardDisabled]}
              onPress={() => handleProductPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.imageBox}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.productImage} />
                ) : (
                  <Ionicons name="cube-outline" size={32} color="#94A3B8" />
                )}
                {inCartCount > 0 && (
                  <View style={styles.inCartBadge}>
                    <Text style={styles.inCartText}>{inCartCount}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <MoneyText amountMinor={item.primary_price_minor} style={styles.priceText} />
                <View style={styles.stockRow}>
                  <StockBadge
                    quantity={item.total_stock}
                    lowStockThreshold={item.variants[0]?.low_stock_threshold}
                    unitLabel={item.variants[0]?.unit_label ?? 'units'}
                  />
                  {item.has_multiple_variants && (
                    <Text style={styles.variantTag}>Options</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Bottom Cart Bar */}
      {cart.totalQuantity > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInfo}>
            <Text style={styles.cartCountText}>
              {cart.totalQuantity} {cart.totalQuantity === 1 ? 'item' : 'items'}
            </Text>
            <MoneyText amountMinor={cart.totalMinor} style={styles.cartTotalText} />
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => setCartModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="cart" size={18} color="#FFFFFF" />
            <Text style={styles.checkoutBtnText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Variant Selector Modal */}
      <Modal visible={variantModalProduct !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Variant</Text>
            <Text style={styles.modalSubtitle}>{variantModalProduct?.name}</Text>

            <ScrollView style={styles.variantList}>
              {variantModalProduct?.variants.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.variantItem, v.stock_quantity <= 0 && styles.variantItemDisabled]}
                  onPress={() => handleSelectVariant(v)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantLabelText}>{v.label}</Text>
                    <Text style={styles.variantStockText}>
                      Stock: {v.stock_quantity} {v.unit_label}
                    </Text>
                  </View>
                  <MoneyText amountMinor={v.price_minor} style={styles.variantPriceText} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setVariantModalProduct(null)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Checkout Drawer / Cart Modal */}
      <Modal visible={cartModalVisible} transparent animationType="slide">
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerCard}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Current Cart ({cart.totalQuantity})</Text>
              <TouchableOpacity onPress={cart.clear}>
                <Text style={styles.clearCartText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cartItemsScroll}>
              {cart.items.map((item) => (
                <View key={item.variant_id} style={styles.cartItemRow}>
                  <View style={styles.cartItemDetails}>
                    <Text style={styles.cartItemName}>{item.product_name}</Text>
                    <Text style={styles.cartItemVariant}>
                      {item.variant_label} • <MoneyText amountMinor={item.unit_price_minor} />
                    </Text>
                  </View>

                  {/* Quantity Stepper */}
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => cart.updateQuantity(item.variant_id, item.quantity - 1)}
                    >
                      <Ionicons name="remove" size={16} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.stepQty}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => cart.updateQuantity(item.variant_id, item.quantity + 1)}
                    >
                      <Ionicons name="add" size={16} color="#0F172A" />
                    </TouchableOpacity>
                  </View>

                  <MoneyText
                    amountMinor={item.unit_price_minor * item.quantity}
                    style={styles.cartLineTotal}
                  />

                  <TouchableOpacity
                    onPress={() => cart.removeItem(item.variant_id)}
                    style={styles.removeCartItemBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Payment & Totals */}
            <View style={styles.checkoutFooter}>
              {/* Payment Method Selector */}
              <Text style={styles.sectionSmallTitle}>Payment Method</Text>
              <View style={styles.paymentSelector}>
                {(['CASH', 'E-WALLET', 'CARD', 'OTHER'] as PaymentMethod[]).map((pm) => (
                  <TouchableOpacity
                    key={pm}
                    style={[styles.paymentChip, cart.paymentMethod === pm && styles.paymentChipActive]}
                    onPress={() => cart.setPaymentMethod(pm)}
                  >
                    <Text
                      style={[
                        styles.paymentChipText,
                        cart.paymentMethod === pm && styles.paymentChipTextActive,
                      ]}
                    >
                      {pm}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Discount Input */}
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Discount (₱)</Text>
                <TextInput
                  style={styles.calcInput}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={discountInput}
                  onChangeText={handleDiscountChange}
                />
              </View>

              {/* Cash received & change calculation */}
              {cart.paymentMethod === 'CASH' && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Cash Received (₱)</Text>
                  <TextInput
                    style={styles.calcInput}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    value={cashInput}
                    onChangeText={handleCashChange}
                  />
                </View>
              )}

              {cart.paymentMethod === 'CASH' && cart.cashReceivedMinor !== null && (
                <View style={styles.summaryLine}>
                  <Text style={styles.calcLabel}>Change Due</Text>
                  <MoneyText amountMinor={cart.changeMinor} style={styles.changeDueText} />
                </View>
              )}

              {/* Total Summary */}
              <View style={styles.summaryTotalRow}>
                <Text style={styles.totalLabel}>Total Due</Text>
                <MoneyText amountMinor={cart.totalMinor} style={styles.totalValue} />
              </View>

              <View style={styles.drawerButtons}>
                <TouchableOpacity
                  style={styles.drawerCancelBtn}
                  onPress={() => setCartModalVisible(false)}
                >
                  <Text style={styles.drawerCancelText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.drawerConfirmBtn, submitting && styles.drawerConfirmBtnDisabled]}
                  onPress={handleCommitSale}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.drawerConfirmText}>Confirm Sale</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sale Success Modal */}
      <Modal visible={completedReceipt !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={36} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>Sale Completed!</Text>
            <Text style={styles.successReceipt}>{completedReceipt?.receiptNumber}</Text>

            <View style={styles.successBreakdown}>
              <View style={styles.successRow}>
                <Text style={styles.successRowLabel}>Total Paid</Text>
                <MoneyText amountMinor={completedReceipt?.totalMinor} style={styles.successRowValue} />
              </View>
              {(completedReceipt?.changeMinor ?? 0) > 0 && (
                <View style={styles.successRow}>
                  <Text style={styles.successRowLabel}>Change</Text>
                  <MoneyText amountMinor={completedReceipt?.changeMinor} style={styles.successRowChange} />
                </View>
              )}
            </View>

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={styles.viewReceiptBtn}
                onPress={() => {
                  const id = completedReceipt?.saleId;
                  setCompletedReceipt(null);
                  if (id) router.push(`/sales/${id}`);
                }}
              >
                <Text style={styles.viewReceiptText}>View Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.newSaleBtn}
                onPress={() => setCompletedReceipt(null)}
              >
                <Text style={styles.newSaleText}>New Sale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product to Add"
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  listContent: {
    padding: 12,
    paddingBottom: 90,
  },
  columnWrapper: {
    gap: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  imageBox: {
    height: 100,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  inCartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#2563EB',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    minHeight: 36,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
    marginVertical: 4,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  variantTag: {
    fontSize: 11,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomBarInfo: {},
  cartCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  cartTotalText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  variantList: {
    marginBottom: 16,
  },
  variantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  variantItemDisabled: {
    opacity: 0.4,
  },
  variantLabelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  variantStockText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  variantPriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '88%',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  clearCartText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  cartItemsScroll: {
    paddingHorizontal: 20,
    maxHeight: 220,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  cartItemVariant: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  stepBtn: {
    padding: 6,
  },
  stepQty: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 22,
    textAlign: 'center',
    color: '#0F172A',
  },
  cartLineTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 64,
    textAlign: 'right',
  },
  removeCartItemBtn: {
    padding: 4,
  },
  checkoutFooter: {
    padding: 20,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionSmallTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  paymentSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  paymentChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  paymentChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentChipTextActive: {
    color: '#FFFFFF',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  calcInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    width: 100,
    textAlign: 'right',
    color: '#0F172A',
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeDueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 6,
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
  },
  drawerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  drawerCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerCancelText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  drawerConfirmBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  drawerConfirmBtnDisabled: {
    opacity: 0.6,
  },
  drawerConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  successReceipt: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  successBreakdown: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successRowLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  successRowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  successRowChange: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },
  successButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  viewReceiptBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewReceiptText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 14,
  },
  newSaleBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  newSaleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
