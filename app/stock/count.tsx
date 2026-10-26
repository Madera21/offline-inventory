import React, { useState } from 'react';
import { Alert } from 'react-native';
import { StoreButton, StoreCard, StoreField, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { useStoreCatalog } from '../../src/utils/useStoreCatalog';
import { wholeQuantity } from '../../src/utils/quantities';
import { storeRepository } from '../../src/db/repositories/store.repository';
import { useLabels } from '../../src/store/PreferencesProvider';

export default function CountStockScreen() {
  const { variants, load, error } = useStoreCatalog();
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, { value: string; expected: number }>>({});
  const [scanner, setScanner] = useState(false);
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  return <StorePage title={t('count')}>
    <StoreText muted>Enter what is actually on the shelf. Leave uncounted items blank. Changes are recorded in stock history.</StoreText>
    {error ? <StoreText>{error}</StoreText> : null}
    <StoreField label={t('search')} value={search} onChangeText={setSearch} />
    <StoreButton secondary label="Scan an item" onPress={() => setScanner(true)} />
    <StoreButton secondary label="Refresh counts" disabled={busy} onPress={() => { if (!Object.keys(counts).length) void load(); else Alert.alert('Discard entered counts?', 'Refreshing clears your unsaved counts.', [{ text: 'Cancel' }, { text: 'Refresh', onPress: () => { setCounts({}); void load(); } }]); }} />
    {variants.filter(v => `${v.product_name} ${v.label} ${v.barcode ?? ''}`.toLowerCase().includes(search.toLowerCase())).map(v => <StoreCard key={v.id}>
      <StoreText>{v.product_name} · {v.label}</StoreText>
      <StoreText muted>Recorded: {v.stock_quantity} {v.unit_label}</StoreText>
      <StoreField label={`Counted ${v.product_name} ${v.label}`} numeric value={counts[v.id]?.value ?? ''} onChangeText={value => setCounts(previous => ({ ...previous, [v.id]: { value, expected: previous[v.id]?.expected ?? v.stock_quantity } }))} />
      {counts[v.id]?.value && /^\d+$/.test(counts[v.id].value) ? <StoreText>Difference: {Number(counts[v.id].value) - counts[v.id].expected}</StoreText> : null}
    </StoreCard>)}
    <StoreButton label="Save stock count" disabled={busy} onPress={() => run(async () => {
      const lines = Object.entries(counts).filter(([, count]) => count.value.trim()).map(([variantId, count]) => ({ variantId, counted: wholeQuantity(count.value, true), expected: count.expected }));
      await storeRepository.countStock(lines); setCounts({}); await load(); Alert.alert('Stock count saved', 'Your inventory and stock history have been updated.');
    })} />
    <BarcodeScannerModal visible={scanner} onClose={() => setScanner(false)} onScan={code => {
      if (!variants.some(v => v.barcode === code || v.sku === code)) Alert.alert('Not found', 'This barcode is not in your active inventory.');
      else setSearch(code);
    }} title="Scan to count" />
  </StorePage>;
}
