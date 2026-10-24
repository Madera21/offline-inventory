import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { stockRepository } from '../../src/db/repositories/stock.repository';
import { salesService } from '../../src/services/sales.service';
import { StockMovement, Sale } from '../../src/types';
import { formatDateTime } from '../../src/utils/dates';
import { MoneyText } from '../../src/components/MoneyText';
import { EmptyState } from '../../src/components/EmptyState';

export default function HistoryTabScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'SALES' | 'MOVEMENTS'>('SALES');
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<(StockMovement & { product_name: string; variant_label: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [salesData, movementsData] = await Promise.all([
        salesService.getAllSales(100),
        stockRepository.getAllMovements(100),
      ]);
      setSales(salesData);
      setMovements(movementsData);
    } catch (err) {
      console.error('Failed to load history data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const getMovementIcon = (type: string, delta: number) => {
    if (delta > 0) return { name: 'arrow-down-circle' as const, color: colors.success };
    return { name: 'arrow-up-circle' as const, color: colors.danger };
  };

  return (
    <View style={styles.container}>
      {/* Top Segmented Filter */}
      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'SALES' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('SALES')}
          >
            <Text style={[styles.segmentText, activeTab === 'SALES' && styles.segmentTextActive]}>
              Sales Receipts ({sales.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'MOVEMENTS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('MOVEMENTS')}
          >
            <Text style={[styles.segmentText, activeTab === 'MOVEMENTS' && styles.segmentTextActive]}>
              Stock Movements ({movements.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sales List */}
      {activeTab === 'SALES' ? (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isVoided = item.status === 'VOIDED';
            return (
              <TouchableOpacity
                style={[styles.saleCard, isVoided && styles.saleCardVoided]}
                onPress={() => router.push(`/sales/${item.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.saleHeader}>
                  <Text style={styles.receiptNumber}>{item.receipt_number}</Text>
                  <MoneyText amountMinor={item.total_minor} style={styles.saleTotal} />
                </View>

                <View style={styles.saleFooter}>
                  <Text style={styles.saleMeta}>
                    {formatDateTime(item.sold_at)} • {item.payment_method}
                  </Text>
                  <View style={[styles.saleBadge, isVoided ? styles.badgeVoided : styles.badgeCompleted]}>
                    <Text style={[styles.badgeText, isVoided ? styles.badgeTextVoided : styles.badgeTextCompleted]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="receipt-outline"
                title="No Sales Recorded Yet"
                description="Completed transactions from Quick Sale will appear here."
                actionLabel="Make a Sale"
                onAction={() => router.push('/(tabs)/sell')}
              />
            ) : undefined
          }
        />
      ) : (
        /* Stock Movements List */
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const icon = getMovementIcon(item.movement_type, item.quantity_delta);
            const isPositive = item.quantity_delta > 0;
            return (
              <View style={styles.movementItem}>
                <Ionicons name={icon.name} size={28} color={icon.color} style={styles.icon} />
                <View style={styles.itemDetails}>
                  <Text style={styles.productName}>{item.product_name}</Text>
                  <Text style={styles.variantLabel}>
                    {item.variant_label} • {item.movement_type.replace('_', ' ')}
                  </Text>
                  {item.reason && <Text style={styles.reasonText}>Note: {item.reason}</Text>}
                  <Text style={styles.timestamp}>{formatDateTime(item.occurred_at)}</Text>
                </View>
                <View style={styles.deltaContainer}>
                  <Text style={[styles.deltaText, isPositive ? styles.deltaPositive : styles.deltaNegative]}>
                    {isPositive ? `+${item.quantity_delta}` : item.quantity_delta}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="time-outline"
                title="No Stock Movements"
                description="Stock adjustments, initial counts, sales, and returns will appear here."
              />
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  segmentedContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.soft,
    borderRadius: 8,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 2,
    elevation: 0,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.ink,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  saleCard: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  saleCardVoided: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptNumber: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  saleTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.accent,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  saleMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  saleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeCompleted: {
    backgroundColor: colors.successSoft,
  },
  badgeTextCompleted: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.success,
  },
  badgeVoided: {
    backgroundColor: colors.dangerSoft,
  },
  badgeTextVoided: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.danger,
  },
  badgeText: {},
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 7,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: {
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  variantLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  deltaContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  deltaText: {
    fontSize: 18,
    fontWeight: '500',
  },
  deltaPositive: {
    color: colors.success,
  },
  deltaNegative: {
    color: colors.danger,
  },
});
