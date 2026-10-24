import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { expirationStatus } from '../utils/expiration';
import { useLocalDate } from '../utils/useLocalDate';

export function ExpirationBadge({ date, prefix }: { date?: string | null; prefix?: string }) {
  const { colors } = useTheme();
  const status = expirationStatus(date, useLocalDate());
  if (!status) return null;
  const label = status === 'expired' ? 'Expired' : status === 'today' ? 'Expires today' : status === 'soon' ? 'Expiring soon' : 'Expires';
  return <Text style={{ color: status === 'expired' ? colors.danger : status === 'future' ? colors.muted : colors.warning, fontSize: 12, marginTop: 6 }}>
    {prefix ? `${prefix}: ` : ''}{label} · {date}
  </Text>;
}
