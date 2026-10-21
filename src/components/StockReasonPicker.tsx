import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StockMovementType } from '../types';

const REASONS: Partial<Record<StockMovementType, string[]>> = {
  RESTOCK: ['Supplier delivery', 'New stock purchase', 'Stock transfer received'],
  DAMAGE: ['Damaged or broken item', 'Expired product', 'Defective product', 'Lost or missing stock'],
  CUSTOMER_RETURN: ['Unopened item returned', 'Wrong item returned', 'Customer exchange'],
  ADJUSTMENT: ['Physical stock count correction', 'Opening balance correction', 'Previously unrecorded stock'],
};

export const MANUAL_STOCK_REASON = '__manual__';

export function StockReasonPicker({ movementType, selectedReason, manualReason, onSelect, onManualChange, disabled = false }: {
  movementType: StockMovementType;
  selectedReason: string | null;
  manualReason: string;
  onSelect: (reason: string) => void;
  onManualChange: (reason: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = [...(REASONS[movementType] || []), MANUAL_STOCK_REASON];
  const label = (reason: string) => reason === MANUAL_STOCK_REASON ? 'Other / Write Manually' : reason;
  return <View>
    <TouchableOpacity
      style={styles.selector}
      accessibilityRole="button"
      accessibilityLabel="Select stock movement reason"
      disabled={disabled}
      onPress={() => setOpen(true)}
    >
      <Text style={styles.text}>{selectedReason ? label(selectedReason) : 'Select a reason...'}</Text>
      <Ionicons name="chevron-down" size={18} color="#64748B" />
    </TouchableOpacity>
    {selectedReason === MANUAL_STOCK_REASON && <TextInput
      style={styles.manualInput}
      accessibilityLabel="Custom stock movement reason"
      placeholder="Write your reason..."
      placeholderTextColor="#94A3B8"
      multiline
      value={manualReason}
      onChangeText={onManualChange}
      editable={!disabled}
    />}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Select Reason</Text>
          <ScrollView>
            {options.map((reason) => <TouchableOpacity
              key={reason}
              style={styles.option}
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === selectedReason }}
              onPress={() => { onSelect(reason); setOpen(false); }}
            >
              <Text style={styles.text}>{label(reason)}</Text>
              <Ionicons name={reason === selectedReason ? 'radio-button-on' : 'radio-button-off'} size={22} color="#2563EB" />
            </TouchableOpacity>)}
          </ScrollView>
          <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFFFFF' },
  text: { flex: 1, color: '#0F172A', fontSize: 15 },
  manualInput: { marginTop: 10, minHeight: 80, textAlignVertical: 'top', padding: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFFFFF', color: '#0F172A', fontSize: 15 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  dialog: { maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cancel: { alignItems: 'center', padding: 14, marginTop: 8 },
  cancelText: { color: '#2563EB', fontWeight: '600' },
});
