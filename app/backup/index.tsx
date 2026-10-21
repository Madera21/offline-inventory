import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { backupService } from '../../src/services/backup.service';
import { reportsRepository } from '../../src/db/repositories/reports.repository';
import { formatDateTime } from '../../src/utils/dates';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const backupUri = await backupService.createFullBackup();
      setLastBackupTime(new Date().toISOString());

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save Offline Inventory Backup',
        });
      } else {
        Alert.alert('Backup Created', `File saved to:\n${backupUri}`);
      }
    } catch (err: any) {
      Alert.alert('Backup Failed', err?.message || 'Failed to create backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePrompt = async () => {
    Alert.alert(
      'Restore From Backup',
      'Restoring a backup will replace your current inventory, products, sales, and photo records with the contents of the backup file. This cannot be undone.\n\nDo you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          style: 'destructive',
          onPress: async () => {
            try {
              // Read recent backup files in documentDirectory for fast restoration test
              const baseDir = FileSystem.documentDirectory;
              if (!baseDir) throw new Error('Document directory not available');

              const files = await FileSystem.readDirectoryAsync(baseDir);
              const backupFiles = files.filter((f) => f.startsWith('offline_inventory_backup_') && f.endsWith('.json'));

              if (backupFiles.length === 0) {
                Alert.alert(
                  'No Local Backup Found',
                  'No previous backup files were detected in app storage. Please create a backup first or place a valid backup JSON in the app folder.'
                );
                return;
              }

              // Pick the most recent backup file
              const latestFile = backupFiles.sort().reverse()[0];
              const fileUri = `${baseDir}${latestFile}`;
              const content = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.UTF8,
              });

              setLoading(true);
              const manifest = await backupService.restoreBackup(content);
              Alert.alert(
                'Restore Complete',
                `Successfully restored:\n• ${manifest.record_counts.products} Products\n• ${manifest.record_counts.variants} Variants\n• ${manifest.record_counts.sales} Sales records\n• ${manifest.record_counts.images} Photos\n\nBackup created on: ${formatDateTime(manifest.created_at)}`
              );
            } catch (err: any) {
              Alert.alert('Restore Failed', err?.message || 'Failed to restore backup.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleExportCsv = async () => {
    try {
      const csv = await reportsRepository.generateProductsCsv();
      const filename = `products_catalog_${Date.now()}.csv`;
      const uri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
      } else {
        Alert.alert('CSV Exported', `Saved to ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Failed to export CSV.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Warning Notice */}
      <View style={styles.warningCard}>
        <Ionicons name="warning-outline" size={24} color="#D97706" style={styles.warningIcon} />
        <View style={styles.warningTextContainer}>
          <Text style={styles.warningTitle}>Important: Local-Only Data</Text>
          <Text style={styles.warningDesc}>
            All inventory data is stored only on this device. If this phone is lost, wiped, or the app is uninstalled, your records cannot be recovered without a saved backup file.
          </Text>
        </View>
      </View>

      {/* Backup Section */}
      <Text style={styles.sectionHeader}>Create Backup</Text>
      <View style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="cloud-upload-outline" size={24} color="#2563EB" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Full Data & Photos Archive</Text>
            <Text style={styles.actionSubtitle}>
              Packages all categories, products, stock ledger, sales history, and product photos.
            </Text>
          </View>
        </View>

        {lastBackupTime && (
          <Text style={styles.lastBackupText}>
            Last created: {formatDateTime(lastBackupTime)}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleCreateBackup}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Create & Save Backup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Restore Section */}
      <Text style={styles.sectionHeader}>Restore Data</Text>
      <View style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="refresh-circle-outline" size={24} color="#DC2626" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Restore from Backup File</Text>
            <Text style={styles.actionSubtitle}>
              Replaces the current database and media storage with a previously exported backup.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.dangerBtn, loading && styles.btnDisabled]}
          onPress={handleRestorePrompt}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Ionicons name="reload-outline" size={18} color="#DC2626" />
          <Text style={styles.dangerBtnText}>Restore Backup</Text>
        </TouchableOpacity>
      </View>

      {/* Quick CSV Export */}
      <Text style={styles.sectionHeader}>Portable Spreadsheet Export</Text>
      <View style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="document-text-outline" size={24} color="#16A34A" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Export Products to CSV</Text>
            <Text style={styles.actionSubtitle}>
              Spreadsheet of all active items, current stock quantities, prices, and costs.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleExportCsv} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color="#0F172A" />
          <Text style={styles.secondaryBtnText}>Share Products CSV</Text>
        </TouchableOpacity>
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
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  warningIcon: {
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  warningDesc: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  lastBackupText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  dangerBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  secondaryBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
