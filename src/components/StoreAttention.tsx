import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { productsRepository } from '../db/repositories/products.repository';
import { storeRepository } from '../db/repositories/store.repository';
import { matchesExpirationFilter } from '../utils/expiration';
import { useLocalDate } from '../utils/useLocalDate';
import { ProductWithDetails } from '../types';
import { StoreButton, StoreCard, StoreText } from './StoreForm';
import { useLabels } from '../store/PreferencesProvider';

export function StoreAttention() {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [reminders, setReminders] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();
  const now = useLocalDate();
  const { t } = useLabels();
  const load = useCallback(async () => {
    try {
      const [catalog, last, enabled] = await Promise.all([productsRepository.getAllWithDetails({ status: 'ACTIVE' }),
        storeRepository.setting('last_backup_at'), storeRepository.setting('backup_reminders')]);
      setProducts(catalog); setLastBackup(last); setReminders(enabled !== 'false'); setError(false);
    } catch { setError(true); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const low = products.filter(product => product.variants.some(v => v.low_stock_threshold !== null && v.stock_quantity <= v.low_stock_threshold)).length;
  const expired = products.filter(product => product.variants.some(v => matchesExpirationFilter(v, 'expired', now))).length;
  const soon = products.filter(product => product.variants.some(v => matchesExpirationFilter(v, 'soon', now))).length;
  const backupDue = reminders && (!lastBackup || !Number.isFinite(Date.parse(lastBackup)) || now.getTime() - Date.parse(lastBackup) >= 7 * 86400000);
  return <StoreCard>
    <StoreText>{t('attention')}</StoreText>
    {error ? <StoreButton secondary label="Could not refresh alerts · Retry" onPress={() => void load()} /> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[{ label: `${low} · ${t('lowStock')}`, url: '/(tabs)/inventory?lowStock=1' },
          { label: `${soon} · ${t('soon')}`, url: '/(tabs)/inventory?expiration=soon&lowStock=0' },
          { label: `${expired} · ${t('expired')}`, url: '/(tabs)/inventory?expiration=expired&lowStock=0' }].map(item =>
          <TouchableOpacity key={item.url} accessibilityRole="button" onPress={() => router.push(item.url as any)} style={{ padding: 12, backgroundColor: colors.warningSoft, borderRadius: 7 }}>
            <Text style={{ color: colors.warning, fontSize: 12 }}>{item.label}</Text>
          </TouchableOpacity>)}
      </View>
      {backupDue && <StoreButton secondary label={t('backup')} onPress={() => router.push('/backup')} />}
    </>}
    <StoreButton secondary label={t('count')} onPress={() => router.push('/stock/count')} />
    <StoreButton secondary label={t('shopping')} onPress={() => router.push('/shopping')} />

  </StoreCard>;
}
