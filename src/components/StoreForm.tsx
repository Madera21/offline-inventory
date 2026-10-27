import { useLabels } from '../store/PreferencesProvider';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';

export function StorePage({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return <KeyboardAwareScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 14 }}>
    <Text style={{ color: colors.ink, fontFamily: 'serif', fontSize: 28 }}>{title}</Text>{children}
  </KeyboardAwareScrollView>;
}
export function StoreCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ padding: 16, gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 7 }}>{children}</View>;
}
export function StoreText({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  const { translate } = useLabels();
  const { colors } = useTheme();
  return <Text style={{ color: muted ? colors.muted : colors.ink, fontSize: muted ? 12 : 15, lineHeight: 21 }}>{typeof children === 'string' ? translate(children) : children}</Text>;
}
export function StoreField({ label, value, onChangeText, numeric = false }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean }) {
  const { colors } = useTheme();
  const { translate } = useLabels();
  return <View style={{ gap: 5 }}><StoreText>{label}</StoreText><TextInput accessibilityLabel={translate(label)} value={value} onChangeText={onChangeText}
    keyboardType={numeric ? 'decimal-pad' : 'default'} style={{ padding: 12, color: colors.ink, backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 7 }} /></View>;
}
export function StoreButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const { translate } = useLabels();
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate(label)} disabled={disabled} onPress={onPress}
    style={{ padding: 13, alignItems: 'center', borderRadius: 7, opacity: disabled ? 0.5 : 1, backgroundColor: secondary ? colors.soft : colors.accent }}>
    <Text style={{ color: secondary ? colors.ink : colors.onAccent, fontWeight: '500' }}>{translate(label)}</Text>
  </TouchableOpacity>;
}

/** A synchronous guard prevents double submissions before React updates the button. */
export function useStoreAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await operation(); }
    catch (error: any) { Alert.alert('Could not save', error?.message || 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, run };
}
