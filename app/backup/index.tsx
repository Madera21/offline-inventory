import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { storeRepository } from '../../src/db/repositories/store.repository';
import { StoreButton } from '../../src/components/StoreForm';
import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import React, { useState, useCallback } from 'react';
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
  const { colors, styles } = useThemeStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [reminders, setReminders] = useState(true);
  useFocusEffect(useCallback(() => {
    void Promise.all([storeRepository.setting('last_backup_at'), storeRepository.setting('backup_reminders')])
      .then(([last, enabled]) => { setLastBackupTime(last); setReminders(enabled !== 'false'); })
      .catch(() => Alert.alert('Could not load backup settings', 'Please reopen this screen.'));
  }, []));

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
    if (loading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(content);
      if (!parsed.manifest || parsed.manifest.format_version !== 1 || !parsed.data) throw new Error('Choose an inventory backup JSON file.');
      Alert.alert('Replace current records?', `Restore ${file.name} from ${formatDateTime(parsed.manifest.created_at)}? Your current records will be replaced.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore backup', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            const manifest = await backupService.restoreBackup(content);
            setLastBackupTime(await storeRepository.setting('last_backup_at'));
            Alert.alert('Restore complete', `${manifest.record_counts.products} products and ${manifest.record_counts.sales} sales restored.`);
          } catch (error: any) { Alert.alert('Restore failed', error.message || 'Please try again.'); }
          finally { setLoading(false); }
        } },
      ]);
    } catch (error: any) { Alert.alert('Could not open backup', error.message || 'Please choose another file.'); }
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
        <Ionicons name="warning-outline" size={24} color={colors.warning} style={styles.warningIcon} />
        <View style={styles.warningTextContainer}>
          <Text style={styles.warningTitle}>Important: Local-Only Data</Text>
          <Text style={styles.warningDesc}>
            All inventory data is stored only on this device. If this phone is lost, wiped, or the app is uninstalled, your records cannot be recovered without a saved backup file.
          </Text>
        </View>
      </View>

      <StoreButton secondary label={`Weekly backup reminder: ${reminders ? 'On' : 'Off'}`} onPress={async () => {
        try { await storeRepository.setSetting('backup_reminders', reminders ? 'false' : 'true'); setReminders(!reminders); }
        catch { Alert.alert('Could not save reminder', 'Please try again.'); }
      }} />
      {/* Backup Section */}
      <Text style={styles.sectionHeader}>Create Backup</Text>
      <View style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.accent} />
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
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.onAccent} />
              <Text style={styles.primaryBtnText}>Create & Save Backup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Restore Section */}
      <Text style={styles.sectionHeader}>Restore Data</Text>
      <View style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="refresh-circle-outline" size={24} color={colors.danger} />
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
          <Ionicons name="reload-outline" size={18} color={colors.danger} />
          <Text style={styles.dangerBtnText}>Restore Backup</Text>
        </TouchableOpacity>
      </View>

      {/* Quick CSV Export */}
      <Text style={styles.sectionHeader}>Portable Spreadsheet Export</Text>
      <View style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="document-text-outline" size={24} color={colors.success} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Export Products to CSV</Text>
            <Text style={styles.actionSubtitle}>
              Spreadsheet of all active items, current stock quantities, prices, and costs.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleExportCsv} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={colors.ink} />
          <Text style={styles.secondaryBtnText}>Share Products CSV</Text>
        </TouchableOpacity>
      </View>
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
  warningCard: {
    flexDirection: 'row',
    backgroundColor: colors.warningSoft,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.warningSoft,
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
    fontWeight: '500',
    color: colors.warning,
    marginBottom: 4,
  },
  warningDesc: {
    fontSize: 12,
    color: colors.warning,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 7,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
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
    fontWeight: '500',
    color: colors.ink,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  lastBackupText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '500',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  dangerBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  secondaryBtnText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
