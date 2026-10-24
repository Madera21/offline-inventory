import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function ExpirationDateField({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { colors } = useTheme();
  return <View style={{ marginVertical: 8 }}>
    <Text style={{ color: colors.ink, marginBottom: 4 }}>Expiration date (optional)</Text>
    <TextInput accessibilityLabel="Expiration date" value={value} onChangeText={onChangeText}
      placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false}
      style={{ color: colors.ink, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 10 }} />
    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>One date for this variant. Leave blank or clear to remove.</Text>
  </View>;
}
