import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ProductVariant } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { productsRepository } from '../db/repositories/products.repository';
import { ExpirationDateField } from './ExpirationDateField';

export function ExpirationDateEditor({ variant, onSaved }: { variant: ProductVariant; onSaved: () => Promise<void> }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await productsRepository.updateVariantExpiration(variant.id, date);
      setOpen(false);
      await onSaved();
    } catch (error: any) { Alert.alert('Expiration date', error.message || 'Could not save date.'); }
    finally { setSaving(false); }
  };
  return <>
    <TouchableOpacity accessibilityRole="button" onPress={() => { setDate(variant.expiration_date || ''); setOpen(true); }} style={{ paddingVertical: 10 }}>
      <Text style={{ color: colors.accent }}>Edit expiration date</Text>
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!saving) setOpen(false); }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, backgroundColor: colors.surface, borderRadius: 8 }} contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: colors.ink, fontSize: 18 }}>{variant.label}</Text>
          <ExpirationDateField value={date} onChangeText={setDate} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 12 }}>
            <TouchableOpacity disabled={saving} onPress={() => setOpen(false)}><Text style={{ color: colors.muted }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity disabled={saving} onPress={save}><Text style={{ color: colors.accent }}>{saving ? 'Saving…' : 'Save date'}</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </>;
}
