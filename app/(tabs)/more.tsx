import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteAllAppData } from '../../src/services/reset.service';

export default function MoreScreen() {
  const { colors, styles, appearance, setAppearance } = useThemeStyles(createStyles);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  const handleDeleteData = () => {
    if (deletingRef.current) return;
    Alert.alert(
      'Delete All Data?',
      'This permanently deletes all products, categories, stock history, sales, photos, and backups/CSV exports stored inside this app. Settings and the cart will be reset. Backups saved outside the app are kept.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete All Data', style: 'destructive', onPress: async () => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          setDeleting(true);
          try {
            const { failedFiles } = await deleteAllAppData();
            await setAppearance('system');
            Alert.alert(
              failedFiles ? 'Records Deleted — File Cleanup Incomplete' : 'All Data Deleted',
              failedFiles
                ? `Your records and cart were cleared, but ${failedFiles} local file or folder could not be removed. Try Delete All Data again to finish cleanup.`
                : 'Your inventory is empty and settings have been reset.',
              [{ text: 'OK', onPress: () => router.replace('/') }]
            );
          } catch (err: any) {
            Alert.alert('Delete Failed', err?.message || 'Could not delete app data. Please try again.');
          } finally {
            deletingRef.current = false;
            setDeleting(false);
          }
        } },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} pointerEvents={deleting ? 'none' : 'auto'}>
      {deleting && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <ActivityIndicator color={colors.danger} />
        <Text style={{ color: colors.ink }}>Deleting app data...</Text>
      </View>}
      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={[styles.menuGroup, { flexDirection: 'row', padding: 5 }]}>
        {(['system', 'light', 'dark'] as const).map(mode => <TouchableOpacity
          key={mode} accessibilityRole="radio" accessibilityState={{ checked: appearance === mode }}
          onPress={() => { void setAppearance(mode); }}
          style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 6, backgroundColor: appearance === mode ? colors.ink : colors.surface }}>
          <Text style={{ color: appearance === mode ? colors.paper : colors.muted, fontWeight: '500' }}>{mode === 'system' ? 'Use device' : mode === 'light' ? 'Light' : 'Dark'}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={styles.sectionTitle}>Inventory Configuration</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/categories')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="folder-open-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Categories</Text>
            <Text style={styles.menuSubtitle}>Create, organize, and archive categories</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/stock/adjust')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="swap-vertical-outline" size={20} color={colors.warning} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Stock Adjustment</Text>
            <Text style={styles.menuSubtitle}>Record restocking, damage, or audit count</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
          <View style={[styles.menuIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Load Sample Demo Data</Text>
            <Text style={styles.menuSubtitle}>Seed sample catalog, variants, and stock for testing</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
          <View style={[styles.menuIcon, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Reconcile Stock Ledger</Text>
            <Text style={styles.menuSubtitle}>Audit stored balances against transaction movements</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Reports & Data</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/reports')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="bar-chart-outline" size={20} color={colors.success} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Sales & Inventory Reports</Text>
            <Text style={styles.menuSubtitle}>Daily sales, gross profit, valuation & CSV export</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/backup')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="cloud-download-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Backup & Restore</Text>
            <Text style={styles.menuSubtitle}>Complete offline backup archive & CSV exports</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Data Management</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteData} disabled={deleting} activeOpacity={0.7}>
          <View style={[styles.menuIcon, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.danger }]}>Delete All Data</Text>
            <Text style={styles.menuSubtitle}>Clear inventory, sales, photos, and local backups</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 20, fontSize: 12 }}>Offline Inventory · 1.0.0 · Philippine Peso (₱)</Text>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.soft,
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
    color: colors.ink,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.soft,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
});
