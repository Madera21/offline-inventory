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
      </View>

      <Text style={styles.sectionTitle}>Reports & Data</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Alert.alert('Reports', 'Reporting module will be available in Phase 4.')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="bar-chart-outline" size={20} color="#16A34A" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Sales & Inventory Reports</Text>
            <Text style={styles.menuSubtitle}>Daily sales, gross profit, and valuation</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Alert.alert('Backup & Restore', 'Full offline ZIP backup and restore will be available in Phase 5.')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#FAF5FF' }]}>
            <Ionicons name="cloud-download-outline" size={20} color="#9333EA" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Backup & Restore</Text>
            <Text style={styles.menuSubtitle}>Export complete archive or CSV reports</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>System Info</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0 (Phase 1: Foundation)</Text>
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
