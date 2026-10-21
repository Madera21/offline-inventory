import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productsRepository } from '../../src/db/repositories/products.repository';
import { MoneyText } from '../../src/components/MoneyText';

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    activeProductsCount: 0,
    variantsCount: 0,
    lowStockCount: 0,
    inventoryValueMinor: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const data = await productsRepository.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#EFF6FF' }]}
          onPress={() => router.push('/products/new')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={26} color="#2563EB" />
          <Text style={[styles.actionTitle, { color: '#1E40AF' }]}>Add Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#F0FDF4' }]}
          onPress={() => router.push('/(tabs)/sell')}
          activeOpacity={0.8}
        >
          <Ionicons name="cart" size={26} color="#16A34A" />
          <Text style={[styles.actionTitle, { color: '#166534' }]}>Quick Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#FEF3C7' }]}
          onPress={() => router.push('/stock/adjust')}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-vertical" size={26} color="#D97706" />
          <Text style={[styles.actionTitle, { color: '#92400E' }]}>Restock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#FAF5FF' }]}
          onPress={() => router.push('/categories')}
          activeOpacity={0.8}
        >
          <Ionicons name="folder-open" size={26} color="#9333EA" />
          <Text style={[styles.actionTitle, { color: '#6B21A8' }]}>Categories</Text>
        </TouchableOpacity>
      </View>

      {/* Inventory Health Cards */}
      <Text style={styles.sectionTitle}>Inventory Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Active Products</Text>
            <Ionicons name="cube-outline" size={20} color="#64748B" />
          </View>
          <Text style={styles.statValue}>{summary.activeProductsCount}</Text>
          <Text style={styles.statSubtext}>{summary.variantsCount} tracked variants</Text>
        </View>

        <TouchableOpacity
          style={[styles.statCard, summary.lowStockCount > 0 ? styles.statCardWarning : null]}
          onPress={() => router.push('/(tabs)/inventory')}
          activeOpacity={0.8}
        >
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, summary.lowStockCount > 0 ? styles.statLabelWarning : null]}>
              Low Stock Alerts
            </Text>
            <Ionicons
              name={summary.lowStockCount > 0 ? 'alert-circle' : 'checkmark-circle-outline'}
              size={20}
              color={summary.lowStockCount > 0 ? '#D97706' : '#16A34A'}
            />
          </View>
          <Text style={[styles.statValue, summary.lowStockCount > 0 ? styles.statValueWarning : null]}>
            {summary.lowStockCount}
          </Text>
          <Text style={styles.statSubtext}>Items at or below limit</Text>
        </TouchableOpacity>

        <View style={[styles.statCard, styles.statCardFull]}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Estimated Inventory Cost Value</Text>
            <Ionicons name="wallet-outline" size={20} color="#64748B" />
          </View>
          <MoneyText amountMinor={summary.inventoryValueMinor} style={styles.statValueLarge} />
          <Text style={styles.statSubtext}>Based on items with recorded purchase cost</Text>
        </View>
      </View>

      {/* System Status Banner */}
      <View style={styles.offlineNotice}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#15803D" />
        <View style={styles.offlineTextContainer}>
          <Text style={styles.offlineTitle}>100% Offline & Private</Text>
          <Text style={styles.offlineDesc}>
            All database records and photos reside securely on this device.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardWarning: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  statCardFull: {
    width: '100%',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  statLabelWarning: {
    color: '#B45309',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  statValueLarge: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2563EB',
  },
  statValueWarning: {
    color: '#D97706',
  },
  statSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  offlineTextContainer: {
    flex: 1,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  offlineDesc: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
  },
});
