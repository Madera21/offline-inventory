import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MoreScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Inventory Configuration</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/categories')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="folder-open-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Categories</Text>
            <Text style={styles.menuSubtitle}>Create, organize, and archive categories</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/stock/adjust')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="swap-vertical-outline" size={20} color="#D97706" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Stock Adjustment</Text>
            <Text style={styles.menuSubtitle}>Record restocking, damage, or audit count</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Diagnostics & Integrity</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={async () => {
            try {
              const { seedDemoData } = await import('../../src/utils/seedData');
              const res = await seedDemoData();
              Alert.alert(
                'Demo Data Loaded',
                `Populated ${res.productsCount} products across ${res.categoriesCount} categories with initial stock and sample transactions.`
              );
            } catch (err: any) {
              Alert.alert('Seed Error', err?.message || 'Failed to seed demo data.');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="sparkles-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Load Sample Demo Data</Text>
            <Text style={styles.menuSubtitle}>Seed sample catalog, variants, and stock for testing</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={async () => {
            try {
              const { stockRepository } = await import('../../src/db/repositories/stock.repository');
              const res = await stockRepository.reconcileAllVariants();
              Alert.alert(
                'Reconciliation Audit Complete',
                `Audited ${res.totalChecked} variant(s).\n${res.discrepanciesFixed === 0 ? 'All stored quantities perfectly match the movement ledger.' : `Repaired ${res.discrepanciesFixed} discrepancy(ies).`}`
              );
            } catch (err: any) {
              Alert.alert('Audit Error', err?.message || 'Failed to reconcile stock.');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Reconcile Stock Ledger</Text>
            <Text style={styles.menuSubtitle}>Audit stored balances against transaction movements</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Reports & Data</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/reports')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="bar-chart-outline" size={20} color="#16A34A" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Sales & Inventory Reports</Text>
            <Text style={styles.menuSubtitle}>Daily sales, gross profit, valuation & CSV export</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/backup')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#FAF5FF' }]}>
            <Ionicons name="cloud-download-outline" size={20} color="#9333EA" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Backup & Restore</Text>
            <Text style={styles.menuSubtitle}>Complete offline backup archive & CSV exports</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>System Info</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0 (Universal Offline Core)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Architecture</Text>
          <Text style={styles.infoValue}>Local-first (SQLite & On-Device Storage)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Default Currency</Text>
          <Text style={styles.infoValue}>Philippine Peso (₱)</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Cloud Dependency</Text>
          <Text style={[styles.infoValue, { color: '#16A34A' }]}>None (100% Offline)</Text>
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
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
});
