import { KeyboardModal as Modal } from '../../src/components/KeyboardModal';
import { KeyboardAwareScrollView as ScrollView } from '../../src/components/KeyboardAwareScrollView';
import { parseStoreAmount } from '../../src/utils/quantities';
import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import { storeRepository, CustomerBalance } from '../../src/db/repositories/store.repository';
import { StoreButton, StoreText } from '../../src/components/StoreForm';
import { ExpirationBadge } from '../../src/components/ExpirationBadge';
import { useLabels } from '../../src/store/PreferencesProvider';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
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
import { FramedProductImage } from '../../src/components/FramedProductImage';
import { readImageFrame } from '../../src/utils/imageFrame';
import { lookupProductByBarcodeOnline } from '../../src/services/productLookup.service';

export default function QuickSaleScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const cart = useCart();

  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const commitLock = React.useRef(false);
  const { t } = useLabels();
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

        setScanMessage(`Added ${product.name} · ${variant.label}`);
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
            `"${online.name}" (${online.brand || 'No brand'})\n\nAdd this product to inventory with its online details? You can choose the photo before saving.`,
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
    credit: boolean;
  } | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const data = await productsRepository.getAllWithDetails({
        search,
        status: 'ACTIVE',
      });
      setProducts(data);
      setCustomers(await storeRepository.customers());
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
    if (product.has_multiple_variants || (product.variants[0]?.pack_size ?? 1) > 1) {
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
    if (cart.items.length === 0 || commitLock.current) return;
    if (cart.paymentMethod === 'CREDIT' && !customerId) { Alert.alert('Customer required', 'Select a customer for this utang sale.'); return; }

    if (cart.paymentMethod === 'CASH' && cart.cashReceivedMinor !== null) {
      if (cart.cashReceivedMinor < cart.totalMinor) {
        Alert.alert(
          'Insufficient Cash',
          `Received amount (${formatMoney(cart.cashReceivedMinor)}) is less than total (${formatMoney(cart.totalMinor)}).`
        );
        return;
      }
    }

    commitLock.current = true;
    setSubmitting(true);
    try {
      const result = await salesService.commitSale({
        items: cart.items,
        discountMinor: parseStoreAmount(discountInput || '0'),
        paymentMethod: cart.paymentMethod,
        customerId,
        cashReceivedMinor: cashInput.trim() ? parseStoreAmount(cashInput) : null,
      });

      const changeMinor = cart.paymentMethod === 'CASH' && cart.cashReceivedMinor !== null ? Math.max(0, cart.cashReceivedMinor - result.total_minor) : 0;
      cart.clear();
      setDiscountInput('');
      setCashInput('');
      setScanMessage('');
      setCartModalVisible(false);

      setCompletedReceipt({
        receiptNumber: result.receipt_number,
        totalMinor: result.total_minor,
        changeMinor,
        saleId: result.id,
        credit: result.payment_method === 'CREDIT',
      });

      await loadProducts();
    } catch (err: any) {
      Alert.alert('Checkout Error', err?.message || 'Failed to complete sale.');
    } finally {
      commitLock.current = false;
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
            <Ionicons name="barcode-outline" size={22} color={colors.onAccent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <StoreButton secondary label={favoritesOnly ? `${t('favorite')} ✓ · Show all` : t('favorite')} onPress={() => setFavoritesOnly(!favoritesOnly)} />
      </View>
      {scanMessage ? <Text accessibilityRole="alert" style={{ color: colors.success, paddingHorizontal: 16, paddingVertical: 6 }}>{scanMessage}</Text> : null}
      {/* Product Catalog Grid */}
      <FlatList
        data={favoritesOnly ? products.filter(product => product.variants.some(variant => variant.favorite)) : products}
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
                  <FramedProductImage uri={imageUri} frame={readImageFrame(item.images[0]?.frame_json)} style={styles.productImage} />
                ) : (
                  <Ionicons name="cube-outline" size={32} color={colors.muted} />
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
                    totalStocked={item.total_stocked}
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
            onPress={() => { setCartModalVisible(true); void storeRepository.customers().then(setCustomers).catch(() => Alert.alert('Could not load customers', 'Please retry checkout.')); }}
            activeOpacity={0.85}
          >
            <Ionicons name="cart" size={18} color={colors.onAccent} />
            <Text style={styles.checkoutBtnText}>{t('checkout')}</Text>
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
                <View
                  key={v.id}
                  style={[styles.variantItem, { flexWrap: 'wrap', gap: 8 }, v.stock_quantity <= 0 && styles.variantItemDisabled]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantLabelText}>{v.label}</Text>
                    <ExpirationBadge date={v.expiration_date} />
                    <Text style={styles.variantStockText}>
                      Stock: {v.stock_quantity}/{v.total_stocked ?? v.stock_quantity} {v.unit_label} remaining
                    </Text>
                  </View>
                  <MoneyText amountMinor={v.price_minor} style={styles.variantPriceText} />
                  <StoreButton secondary label="Add piece" disabled={v.stock_quantity <= 0} onPress={() => handleSelectVariant(v)} />
                  {(v.pack_size ?? 1) > 1 && <StoreButton secondary label={`Add pack (${v.pack_size})`} disabled={v.stock_quantity - (cart.items.find(item => item.variant_id === v.id)?.quantity ?? 0) < v.pack_size!} onPress={() => {
                    if (!variantModalProduct) return;
                    cart.addItem({ variant_id: v.id, product_id: variantModalProduct.id, product_name: variantModalProduct.name, variant_label: v.label, unit_label: v.unit_label, unit_price_minor: v.price_minor, unit_cost_minor: v.cost_minor, max_available_stock: v.stock_quantity }, v.pack_size);
                    setVariantModalProduct(null);
                  }} />}
                </View>
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
          <ScrollView keyboardShouldPersistTaps="handled" style={[styles.drawerCard, { flexGrow: 0 }]} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Current Cart ({cart.totalQuantity})</Text>
              <TouchableOpacity onPress={cart.clear}>
                <Text style={styles.clearCartText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cartItemsScroll}>
              {cart.items.map((item) => (
                <View key={item.variant_id} style={styles.cartItemRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.cartItemDetails}>
                    <Text style={styles.cartItemName}>{item.product_name}</Text>
                    <ExpirationBadge date={products.find(product => product.id === item.product_id)?.variants.find(variant => variant.id === item.variant_id)?.expiration_date} />
                    <Text style={styles.cartItemVariant}>
                      {item.variant_label} • <MoneyText amountMinor={item.unit_price_minor} />
                    </Text>
                  </View>

                  <MoneyText amountMinor={item.unit_price_minor * item.quantity} style={styles.cartLineTotal} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  {/* Quantity Stepper */}
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => cart.updateQuantity(item.variant_id, item.quantity - 1)}
                    >
                      <Ionicons name="remove" size={16} color={colors.ink} />
                    </TouchableOpacity>
                    <TextInput style={[styles.stepQty, { minWidth: 42, padding: 6, textAlign: 'center' }]}
                      accessibilityLabel={`${item.product_name} quantity`} keyboardType="number-pad" selectTextOnFocus
                      value={String(item.quantity)} onChangeText={text => {
                        const value = Number(text);
                        if (/^\d+$/.test(text) && value > 0) cart.updateQuantity(item.variant_id, value);
                      }} />
                    <TouchableOpacity
                      style={styles.stepBtn}
                      disabled={item.quantity >= item.max_available_stock}
                      accessibilityLabel={`Increase ${item.product_name} quantity`}
                      onPress={() => cart.updateQuantity(item.variant_id, item.quantity + 1)}
                    >
                      <Ionicons name="add" size={16} color={colors.ink} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => cart.removeItem(item.variant_id)}
                    accessibilityLabel={`Remove ${item.product_name}`}
                    style={styles.removeCartItemBtn}
                  >
                    <Text style={{ color: colors.danger, fontSize: 13 }}>Remove</Text>
                  </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

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

              <StoreButton secondary label={cart.paymentMethod === 'CREDIT' ? 'Utang selected ✓ · Switch to cash' : 'Pay later / Utang'} onPress={() => cart.setPaymentMethod(cart.paymentMethod === 'CREDIT' ? 'CASH' : 'CREDIT')} />
              {cart.paymentMethod === 'CREDIT' && <View style={{ maxHeight: 160 }}>
                <ScrollView nestedScrollEnabled>
                  <StoreText>Select customer</StoreText>
                  {customers.map(customer => <StoreButton key={customer.id} secondary label={`${customerId === customer.id ? '✓ ' : ''}${customer.name} · ${formatMoney(customer.balance_minor)} owed`} onPress={() => setCustomerId(customer.id)} />)}
                  <StoreButton secondary label="Add / manage customers" onPress={() => { setCartModalVisible(false); router.push('/customers'); }} />
                </ScrollView>
              </View>}
              {/* Discount Input */}
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Discount (₱)</Text>
                <TextInput
                  style={styles.calcInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={discountInput}
                  onChangeText={handleDiscountChange}
                />
              </View>

              {cart.paymentMethod === 'CASH' && <StoreButton secondary label={t('exactCash')} onPress={() => {
                const exact = (cart.totalMinor / 100).toFixed(2); setCashInput(exact); cart.setCashReceived(cart.totalMinor);
              }} />}
              {/* Cash received & change calculation */}
              {cart.paymentMethod === 'CASH' && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Cash Received (₱)</Text>
                  <TextInput
                    style={styles.calcInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
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
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <Text style={styles.drawerConfirmText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Sale Success Modal */}
      <Modal visible={completedReceipt !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={36} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Sale Completed!</Text>
            <Text style={styles.successReceipt}>{completedReceipt?.receiptNumber}</Text>

            <View style={styles.successBreakdown}>
              <View style={styles.successRow}>
                <Text style={styles.successRowLabel}>{completedReceipt?.credit ? 'Added to utang' : 'Total paid'}</Text>
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
                <Text style={styles.newSaleText}>{t('newSale')}</Text>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
  listContent: {
    padding: 12,
    paddingBottom: 90,
  },
  columnWrapper: {
    gap: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 12,
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  imageBox: {
    borderRadius: 7,
    height: 110,
    backgroundColor: colors.soft,
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
    backgroundColor: colors.accent,
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartText: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '500',
  },
  cardInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    minHeight: 36,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
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
    color: colors.muted,
    backgroundColor: colors.soft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 0,
  },
  bottomBarInfo: {},
  cartCountText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  cartTotalText: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  checkoutBtnText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: 7,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.ink,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.muted,
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
    borderBottomColor: colors.soft,
  },
  variantItemDisabled: {
    opacity: 0.4,
  },
  variantLabelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  variantStockText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  variantPriceText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.accent,
  },
  modalCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.soft,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
  },
  clearCartText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
  cartItemsScroll: {
    paddingHorizontal: 20,
  },
  cartItemRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.soft,
    gap: 8,
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  cartItemVariant: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.soft,
    borderRadius: 6,
  },
  stepBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  stepQty: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 22,
    textAlign: 'center',
    color: colors.ink,
  },
  cartLineTotal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    minWidth: 64,
    textAlign: 'right',
  },
  removeCartItemBtn: {
    padding: 12,
  },
  checkoutFooter: {
    padding: 20,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sectionSmallTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
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
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  paymentChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  paymentChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  paymentChipTextActive: {
    color: colors.onAccent,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  calcInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    width: 100,
    textAlign: 'right',
    color: colors.ink,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeDueText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.success,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 6,
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.accent,
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
    borderColor: colors.line,
  },
  drawerCancelText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
  },
  drawerConfirmBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  drawerConfirmBtnDisabled: {
    opacity: 0.6,
  },
  drawerConfirmText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '500',
  },
  successCard: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: 7,
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
  },
  successReceipt: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  successBreakdown: {
    width: '100%',
    backgroundColor: colors.paper,
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
    color: colors.muted,
  },
  successRowValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  successRowChange: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.success,
  },
  successButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  viewReceiptBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewReceiptText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 14,
  },
  newSaleBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  newSaleText: {
    color: colors.onAccent,
    fontWeight: '500',
    fontSize: 14,
  },
});
