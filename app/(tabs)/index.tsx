import React, { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { reportsRepository } from '../../src/db/repositories/reports.repository';
import { ProductVariant, ProductWithDetails } from '../../src/types';
import { useCart } from '../../src/store/cart.store';
import { MoneyText } from '../../src/components/MoneyText';
import { FramedProductImage } from '../../src/components/FramedProductImage';
import { resolveImageUri } from '../../src/services/image.service';
import { readImageFrame } from '../../src/utils/imageFrame';
import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';

type Recommendation = { product: ProductWithDetails; variant: ProductVariant; sold: number };

export default function DashboardScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cart = useCart();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [sales, setSales] = useState({ total: 0, count: 0 });
  const [lowStock, setLowStock] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const loadData = useCallback(async () => {
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const week = new Date(); week.setDate(week.getDate() - 7);
      const [today, best, products] = await Promise.all([
        reportsRepository.getCounterTotals(start.toISOString(), end.toISOString()),
        reportsRepository.getBestSellers(4, week.toISOString(), true),
        productsRepository.getAllWithDetails({ status: 'ACTIVE' }),
      ]);
      const items: Recommendation[] = [];
      best.forEach(item => {
        const product = products.find(p => p.variants.some(v => v.id === item.variant_id));
        const variant = product?.variants.find(v => v.id === item.variant_id && v.status === 'ACTIVE' && v.stock_quantity > 0);
        if (product && variant) items.push({ product, variant, sold: item.total_quantity });
      });
      setSales(today || { total: 0, count: 0 }); setLowStock(products.filter(product => product.variants.some(variant => variant.low_stock_threshold !== null && variant.stock_quantity <= variant.low_stock_threshold)).length);
      setRecommendations(items.slice(0, 4)); setError(false);
    } catch (err) { console.error('Could not load counter:', err); setError(true); }
  }, []);
  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));
  const addToSale = ({ product, variant }: Recommendation) => {
    cart.addItem({ variant_id: variant.id, product_id: product.id, product_name: product.name,
      variant_label: variant.label, unit_label: variant.unit_label, unit_price_minor: variant.price_minor,
      unit_cost_minor: variant.cost_minor, max_available_stock: variant.stock_quantity });
    router.push('/(tabs)/sell');
  };
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.paper }}><ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}>
    <View style={styles.brand}>
      <View style={styles.monogram}><Text style={styles.monogramText}>SS</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.shop}>My sari-sari store</Text><Text style={styles.shopNote}>Your everyday store companion</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="View low stock" onPress={() => router.push('/(tabs)/inventory?lowStock=1')} style={{ padding: 10 }}><Ionicons name="notifications-outline" size={23} color="#FFF7E9" /></TouchableOpacity>
    </View>
    <View style={styles.awning}>{Array.from({ length: 16 }, (_, i) => <View key={i} style={[styles.stripe, { backgroundColor: i % 2 ? '#A34E35' : '#F2DBAD' }]} />)}</View>
    <View style={styles.counter}>
      <Text style={styles.date}>{new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text style={styles.heading}>Tinda, every day.</Text>
      {error && <TouchableOpacity onPress={loadData}><Text style={styles.error}>Could not refresh your counter. Tap to retry.</Text></TouchableOpacity>}
      <View style={styles.metrics}><View style={{ flex: 1.4 }}><Text style={styles.label}>Today's sales</Text><MoneyText amountMinor={sales.total} style={styles.value} /></View><View style={styles.transactions}><Text style={styles.label}>Transactions</Text><Text style={styles.value}>{sales.count}</Text></View></View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => router.push('/stock/adjust')}><Ionicons name="add-circle-outline" size={20} color={colors.ink} /><Text style={styles.actionText}>Restock</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => router.push('/products/new')}><Ionicons name="add" size={20} color={colors.ink} /><Text style={styles.actionText}>Add product</Text></TouchableOpacity>
      </View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Your best sellers</Text><TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}><Text style={styles.label}>Browse stock →</Text></TouchableOpacity></View>
      <Text style={styles.subtitle}>Recommended for your next sale · Last 7 days</Text>
      <View style={styles.shelf}>{recommendations.map((item, index) => {
        const image = item.product.images[0]; const uri = resolveImageUri(image?.relative_path);
        return <TouchableOpacity key={item.variant.id} style={styles.product} onPress={() => addToSale(item)} accessibilityLabel={`Add ${item.product.name}, ${item.variant.label}, to sale`}>
          <View style={styles.art}>{uri ? <FramedProductImage uri={uri} frame={readImageFrame(image?.frame_json)} style={styles.image} /> : <Ionicons name="basket-outline" size={40} color={colors.muted} />}<Text style={styles.rank}>0{index + 1}</Text></View>
          <Text style={styles.productName} numberOfLines={2}>{item.product.name}</Text><Text style={styles.productNote}>{item.sold} sold · {item.variant.label}</Text>
          <View style={styles.priceRow}><MoneyText amountMinor={item.variant.price_minor} style={styles.price} /><View style={styles.add}><Ionicons name="add" size={19} color={colors.ink} /></View></View>
        </TouchableOpacity>;
      })}</View>
      {!recommendations.length && <View style={styles.empty}><Text style={styles.productName}>Your shelf starts here</Text><Text style={styles.subtitle}>Record sales to see your best sellers here. Add loose items and homemade goods without a barcode.</Text><TouchableOpacity onPress={() => router.push('/products/new')}><Text style={styles.link}>+ Add a product manually</Text></TouchableOpacity></View>}
      <TouchableOpacity style={styles.warning} onPress={() => router.push('/(tabs)/inventory?lowStock=1')}><Ionicons name="alert-circle-outline" size={18} color={colors.warning} /><Text style={[styles.warningText, { flex: 1 }]}>{lowStock ? `${lowStock} items to restock` : 'Your stock is looking good'}</Text><Text style={styles.warningText}>View →</Text></TouchableOpacity>
      <TouchableOpacity style={styles.checkout} onPress={() => router.push('/(tabs)/sell')}><View style={{ flex: 1 }}><Text style={styles.checkoutTitle}>New sale →</Text><Text style={styles.checkoutNote}>{cart.totalQuantity ? `${cart.totalQuantity} items in your basket` : 'Pick from your shelf or scan an item'}</Text></View><MoneyText amountMinor={cart.totalMinor} style={styles.checkoutTotal} /></TouchableOpacity>
    </View>
  </ScrollView></View>;
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper }, content: { paddingBottom: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 18, backgroundColor: '#A34E35' },
  monogram: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#EEC8AD', alignItems: 'center', justifyContent: 'center' },
  monogramText: { color: '#FFF7E9', fontSize: 18, fontFamily: serif },
  shop: { fontSize: 20, color: '#FFF7E9', fontFamily: serif }, shopNote: { fontSize: 11, color: '#F2D9C9', marginTop: 4 },
  awning: { flexDirection: 'row', height: 7 }, stripe: { flex: 1 }, counter: { padding: 22 },
  date: { color: c.muted, fontSize: 12 }, heading: { color: c.ink, fontFamily: serif, fontSize: 34, marginTop: 5, marginBottom: 18 },
  metrics: { flexDirection: 'row', backgroundColor: c.soft, borderRadius: 8, padding: 16, marginBottom: 16 }, transactions: { flex: 1, borderLeftWidth: 1, borderColor: c.line, paddingLeft: 18 },
  label: { fontSize: 12, color: c.muted }, value: { fontSize: 26, color: c.ink, marginTop: 7, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 26 }, action: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingVertical: 14, borderRadius: 7 }, actionText: { color: c.ink, fontWeight: '500', fontSize: 14 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, sectionTitle: { fontSize: 20, color: c.ink, fontFamily: serif, flexShrink: 1 }, subtitle: { color: c.muted, fontSize: 12, lineHeight: 19, marginTop: 7, marginBottom: 12 },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, product: { width: '47%', flexGrow: 1, borderBottomWidth: 2, borderColor: c.line, paddingBottom: 12, marginBottom: 2 },
  art: { height: 104, backgroundColor: c.soft, borderRadius: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 }, image: { width: '100%', height: '100%' }, rank: { position: 'absolute', top: 8, left: 8, color: c.ink, backgroundColor: c.paper, padding: 3, fontSize: 11 },
  productName: { fontSize: 15, fontWeight: '500', color: c.ink }, productNote: { color: c.muted, fontSize: 11, lineHeight: 17, marginVertical: 5 }, priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }, price: { color: c.ink, fontWeight: '500', fontSize: 16 }, add: { width: 32, height: 32, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 20 }, link: { color: c.accent, paddingVertical: 12, fontWeight: '600' }, error: { color: c.danger, marginBottom: 14 },
  warning: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: c.warningSoft, padding: 14, borderRadius: 6, marginVertical: 18 }, warningText: { color: c.warning, fontSize: 12, flexShrink: 1 },
  checkout: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 17, borderRadius: 8, backgroundColor: c.ink }, checkoutTitle: { color: c.paper, fontSize: 16, fontWeight: '500' }, checkoutNote: { color: c.paper, opacity: 0.8, fontSize: 11, marginTop: 5 }, checkoutTotal: { color: c.paper, fontSize: 19 },
});
