import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  reportsRepository,
  SalesReportMetrics,
  InventoryValuationMetrics,
  BestSellerItem,
} from '../../src/db/repositories/reports.repository';
import { MoneyText } from '../../src/components/MoneyText';
import { getTodayStartAndEndIso } from '../../src/utils/dates';

type PeriodFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<PeriodFilter>('TODAY');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [salesMetrics, setSalesMetrics] = useState<SalesReportMetrics>({
    totalRevenueMinor: 0,
    transactionCount: 0,
    unitsSold: 0,
    estimatedGrossProfitMinor: 0,
    incompleteCostCount: 0,
  });

  const [valuation, setValuation] = useState<InventoryValuationMetrics>({
    totalActiveProducts: 0,
    totalVariants: 0,
    totalStockUnits: 0,
    inventoryRetailValueMinor: 0,
    inventoryCostValueMinor: 0,
    lowStockItemsCount: 0,
  });

  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);

  const getDateRange = (filter: PeriodFilter) => {
    const now = new Date();
    if (filter === 'TODAY') {
      const { start } = getTodayStartAndEndIso();
      return { start, end: now.toISOString() };
    }
    if (filter === 'WEEK') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: past.toISOString(), end: now.toISOString() };
    }
    if (filter === 'MONTH') {
      const past = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: past.toISOString(), end: now.toISOString() };
    }
    return { start: undefined, end: undefined };
  };

  const loadReportData = useCallback(async () => {
    try {
      const range = getDateRange(period);
      const [sales, val, sellers] = await Promise.all([
        reportsRepository.getSalesReport(range.start, range.end),
        reportsRepository.getInventoryValuation(),
        reportsRepository.getBestSellers(5, range.start),
      ]);
      setSalesMetrics(sales);
      setValuation(val);
      setBestSellers(sellers);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [loadReportData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const handleExportCsv = () => {
    Alert.alert('Export CSV Report', 'Choose report to export', [
      {
        text: 'Products & Stock CSV',
        onPress: async () => {
          try {
            const csv = await reportsRepository.generateProductsCsv();
            const filename = `products_inventory_${Date.now()}.csv`;
            const uri = `${FileSystem.documentDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Products CSV' });
            } else {
              Alert.alert('Exported', `Saved to ${uri}`);
            }
          } catch (err: any) {
            Alert.alert('Export Error', err?.message || 'Failed to export CSV.');
          }
        },
      },
      {
        text: 'Sales Ledger CSV',
        onPress: async () => {
          try {
            const csv = await reportsRepository.generateSalesCsv();
            const filename = `sales_report_${Date.now()}.csv`;
            const uri = `${FileSystem.documentDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Sales CSV' });
            } else {
              Alert.alert('Exported', `Saved to ${uri}`);
            }
          } catch (err: any) {
            Alert.alert('Export Error', err?.message || 'Failed to export CSV.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Date Filter Tabs */}
      <View style={styles.filterRow}>
        {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as PeriodFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, period === f && styles.filterChipActive]}
            onPress={() => setPeriod(f)}
          >
            <Text style={[styles.filterText, period === f && styles.filterTextActive]}>
              {f === 'TODAY' ? 'Today' : f === 'WEEK' ? '7 Days' : f === 'MONTH' ? 'Month' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sales Performance Grid */}
      <Text style={styles.sectionHeader}>Sales Performance</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderLeftColor: '#2563EB', borderLeftWidth: 4 }]}>
          <Text style={styles.statLabel}>Total Sales Revenue</Text>
          <MoneyText amountMinor={salesMetrics.totalRevenueMinor} style={styles.statValueLarge} />
          <Text style={styles.statSub}>{salesMetrics.transactionCount} completed orders</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#16A34A', borderLeftWidth: 4 }]}>
          <Text style={styles.statLabel}>Estimated Gross Profit</Text>
          <MoneyText amountMinor={salesMetrics.estimatedGrossProfitMinor} style={styles.statValueLargeProfit} />
          <Text style={styles.statSub}>
            {salesMetrics.incompleteCostCount > 0
              ? `${salesMetrics.incompleteCostCount} items had no recorded cost`
              : 'Based on full cost tracking'}
          </Text>
        </View>

        <View style={[styles.statCardHalf]}>
          <Text style={styles.statLabel}>Orders</Text>
          <Text style={styles.statValue}>{salesMetrics.transactionCount}</Text>
        </View>

        <View style={[styles.statCardHalf]}>
          <Text style={styles.statLabel}>Units Sold</Text>
          <Text style={styles.statValue}>{salesMetrics.unitsSold}</Text>
        </View>
      </View>

      {/* Inventory Health & Valuation */}
      <Text style={styles.sectionHeader}>Inventory Valuation</Text>
      <View style={styles.valuationCard}>
        <View style={styles.valRow}>
          <Text style={styles.valLabel}>Estimated Retail Value</Text>
          <MoneyText amountMinor={valuation.inventoryRetailValueMinor} style={styles.valValueBold} />
        </View>
        <View style={styles.valRow}>
          <Text style={styles.valLabel}>Total Stock at Cost</Text>
          <MoneyText amountMinor={valuation.inventoryCostValueMinor} style={styles.valValue} />
        </View>
        <View style={styles.valRow}>
          <Text style={styles.valLabel}>Total Physical Units</Text>
          <Text style={styles.valValue}>{valuation.totalStockUnits} units</Text>
        </View>
        <View style={[styles.valRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.valLabel}>Low Stock Items</Text>
          <Text style={[styles.valValue, valuation.lowStockItemsCount > 0 && { color: '#D97706', fontWeight: '700' }]}>
            {valuation.lowStockItemsCount} items
          </Text>
        </View>
      </View>

      {/* Best Sellers */}
      <Text style={styles.sectionHeader}>Top Selling Products</Text>
      <View style={styles.sellersCard}>
        {bestSellers.length > 0 ? (
          bestSellers.map((item, index) => (
            <View key={item.variant_id} style={[styles.sellerRow, index === bestSellers.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.rankCircle}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{item.product_name}</Text>
                <Text style={styles.sellerSub}>{item.variant_label}</Text>
              </View>
              <View style={styles.sellerStats}>
                <Text style={styles.sellerUnits}>{item.total_quantity} sold</Text>
                <MoneyText amountMinor={item.total_revenue_minor} style={styles.sellerRev} />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noSellersText}>No sales recorded for this timeframe.</Text>
        )}
      </View>

      {/* CSV Export Action Button */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExportCsv} activeOpacity={0.85}>
        <Ionicons name="download-outline" size={20} color="#FFFFFF" />
        <Text style={styles.exportBtnText}>Export CSV Report</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardHalf: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  statValueLarge: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2563EB',
  },
  statValueLargeProfit: {
    fontSize: 28,
    fontWeight: '800',
    color: '#16A34A',
  },
  statSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  valuationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  valRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  valLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  valValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  valValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  sellersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  sellerSub: {
    fontSize: 12,
    color: '#64748B',
  },
  sellerStats: {
    alignItems: 'flex-end',
  },
  sellerUnits: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sellerRev: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 2,
  },
  noSellersText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
    fontSize: 13,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
