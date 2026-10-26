import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StockBatch } from '../../src/db/batches';
import { storeRepository } from '../../src/db/repositories/store.repository';
import { StoreButton, StoreCard, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { ExpirationDateField } from '../../src/components/ExpirationDateField';
import { ExpirationBadge } from '../../src/components/ExpirationBadge';
import { useLabels } from '../../src/store/PreferencesProvider';

export default function BatchesScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  const load = useCallback(async () => {
    try { setBatches(await storeRepository.batches(variantId)); setError(''); }
    catch { setError('Could not load batches.'); }
  }, [variantId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <StorePage title={t('batches')}>
    <StoreText muted>Each delivery can have a different expiration date. Sales use the earliest dated stock first; undated stock is used last.</StoreText>
    {error ? <StoreText>{error}</StoreText> : !batches.length ? <StoreText>No stock batches remaining.</StoreText> : null}
    <StoreButton label="Refresh" secondary onPress={() => void load()} />
    {batches.map(batch => <StoreCard key={batch.id}>
      <StoreText>{batch.quantity} pieces remaining</StoreText>
      <StoreText muted>Received {new Date(batch.received_at).toLocaleDateString()}</StoreText>
      <ExpirationBadge date={batch.expiration_date} />
      <ExpirationDateField value={dates[batch.id] ?? batch.expiration_date ?? ''} onChangeText={date => setDates(previous => ({ ...previous, [batch.id]: date }))} />
      <StoreButton label={t('save')} disabled={busy} onPress={() => run(async () => {
        await storeRepository.dateBatch(batch.id, dates[batch.id] ?? batch.expiration_date); await load();
        setDates(previous => { const next = { ...previous }; delete next[batch.id]; return next; });
      })} />
    </StoreCard>)}
  </StorePage>;
}
