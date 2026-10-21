import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { salesService, SaleWithDetails } from '../../src/services/sales.service';
import { MoneyText } from '../../src/components/MoneyText';
import { formatDateTime } from '../../src/utils/dates';

export default function SaleReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [sale, setSale] = useState<SaleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Void modal
  const [voidModalVisible, setVoidModalVisible] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const loadSale = useCallback(async () => {
    if (!id) return;
    try {
      const data = await salesService.getSaleWithDetails(id);
      setSale(data);
    } catch (err) {
      console.error('Failed to load sale receipt:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadSale();
    }, [loadSale])
  );

  const handleVoidSale = async () => {
    if (!sale) return;
    if (!voidReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for voiding this sale.');
      return;
    }

    setVoiding(true);
    try {
      await salesService.voidSale(sale.id, voidReason.trim());
      setVoidModalVisible(false);
      Alert.alert('Sale Voided', 'Sale was voided and inventory stock has been reversed.');
      await loadSale();
    } catch (err: any) {
      Alert.alert('Void Error', err?.message || 'Failed to void sale.');
    } finally {
      setVoiding(false);
    }
  };

  if (loading || !sale) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const isVoided = sale.status === 'VOIDED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.receiptPaper}>
        {/* Header */}
        <View style={styles.receiptHeader}>
          <Text style={styles.storeName}>OFFLINE INVENTORY</Text>
          <Text style={styles.receiptSubtitle}>Official Transaction Receipt</Text>
          <Text style={styles.receiptNumber}>{sale.receipt_number}</Text>
          <Text style={styles.dateTime}>{formatDateTime(sale.sold_at)}</Text>

          <View style={[styles.statusBadge, isVoided ? styles.statusVoided : styles.statusCompleted]}>
            <Text style={[styles.statusText, isVoided ? styles.statusVoidedText : styles.statusCompletedText]}>
              {sale.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Line Items */}
        <Text style={styles.itemsHeader}>Purchased Items</Text>
        {sale.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemVariant}>
                {item.variant_label} ({item.quantity} × <MoneyText amountMinor={item.unit_price_minor} />)
              </Text>
            </View>
            <MoneyText amountMinor={item.line_total_minor} style={styles.itemTotal} />
          </View>
        ))}

        <View style={styles.divider} />

        {/* Totals Breakdown */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <MoneyText amountMinor={sale.subtotal_minor} style={styles.totalValue} />
          </View>

          {sale.discount_minor > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount Applied</Text>
              <Text style={styles.discountText}>- <MoneyText amountMinor={sale.discount_minor} /></Text>
            </View>
          )}

          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <MoneyText amountMinor={sale.total_minor} style={styles.grandTotalValue} />
          </View>

          <View style={[styles.totalRow, { marginTop: 8 }]}>
            <Text style={styles.paymentMethodLabel}>Payment Method</Text>
            <Text style={styles.paymentMethodValue}>{sale.payment_method}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {!isVoided ? (
          <TouchableOpacity
            style={styles.voidBtn}
            onPress={() => setVoidModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.voidBtnText}>Void This Sale</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.voidNotice}>
            <Ionicons name="information-circle-outline" size={20} color="#DC2626" />
            <Text style={styles.voidNoticeText}>
              This sale has been voided. All deducted stock has been safely restored to inventory.
            </Text>
          </View>
        )}
      </View>

      {/* Void Reason Modal */}
      <Modal visible={voidModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Void Transaction</Text>
            <Text style={styles.modalSubtitle}>
              Voiding this sale will reverse all items back into active inventory.
            </Text>

            <Text style={styles.modalLabel}>Reason for Void *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Customer cancelled order / Wrong product scanned"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={voidReason}
              onChangeText={setVoidReason}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setVoidModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmVoidBtn, voiding && styles.btnDisabled]}
                onPress={handleVoidSale}
                disabled={voiding}
              >
                {voiding ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmVoidText}>Confirm Void</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  receiptSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  receiptNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 8,
  },
  dateTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusCompletedText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  statusVoided: {
    backgroundColor: '#FEE2E2',
  },
  statusVoidedText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  statusText: {},
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  itemsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemVariant: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalsSection: {
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  discountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  grandTotalRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
  },
  paymentMethodLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  paymentMethodValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionsContainer: {
    marginTop: 20,
  },
  voidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  voidBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  voidNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  voidNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 16,
    color: '#0F172A',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
  },
  confirmVoidBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmVoidText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
