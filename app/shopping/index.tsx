import React, { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { storeRepository, ShoppingItem } from '../../src/db/repositories/store.repository';
import { StoreButton, StoreCard, StoreField, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { useStoreCatalog } from '../../src/utils/useStoreCatalog';
import { wholeQuantity } from '../../src/utils/quantities';
import { useLabels } from '../../src/store/PreferencesProvider';

export default function ShoppingScreen() {
  const { variants } = useStoreCatalog();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  const load = useCallback(async () => {
    try { setItems(await storeRepository.shopping()); setError(''); } catch { setError('Could not load your list.'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const candidates = variants.filter(v => !items.some(item => item.variant_id === v.id) && (search.trim()
    ? `${v.product_name} ${v.label}`.toLowerCase().includes(search.toLowerCase())
    : v.low_stock_threshold !== null && v.stock_quantity <= v.low_stock_threshold));
  return <StorePage title={t('shopping')}>
    <StoreText muted>Keep a buying list without changing stock. Receive purchases through Receive delivery when they arrive.</StoreText>
    {error ? <StoreText>{error}</StoreText> : null}
    <StoreButton secondary label="Refresh list" disabled={busy} onPress={() => void load()} />
    {items.map(item => <StoreCard key={item.variant_id}>
      <StoreText>{item.checked ? '✓ ' : ''}{item.product_name} · {item.label}</StoreText>
      <StoreField label={`Buy quantity: ${item.unit_label}`} numeric value={drafts[item.variant_id] ?? String(item.quantity)} onChangeText={value => setDrafts(previous => ({ ...previous, [item.variant_id]: value }))} />
      <StoreButton secondary label="Save quantity" disabled={busy} onPress={() => run(async () => { await storeRepository.shopItem(item.variant_id, wholeQuantity(drafts[item.variant_id] ?? item.quantity), !!item.checked); await load(); })} />
      <StoreButton secondary label={item.checked ? 'Mark still needed' : 'Mark bought'} disabled={busy} onPress={() => run(async () => { await storeRepository.shopItem(item.variant_id, wholeQuantity(drafts[item.variant_id] ?? item.quantity), !item.checked); await load(); })} />
      <StoreButton secondary label="Remove from list" disabled={busy} onPress={() => run(async () => { await storeRepository.removeShopping(item.variant_id); await load(); })} />
    </StoreCard>)}
    {!items.length && <StoreText>Your list is empty. Add a low-stock item below or search for a product.</StoreText>}
    <StoreButton label="Share items still needed" disabled={busy || !items.some(item => !item.checked)} onPress={() => run(async () => {
      const message = items.filter(item => !item.checked).map(item => `${wholeQuantity(drafts[item.variant_id] ?? item.quantity)} ${item.unit_label} — ${item.product_name} (${item.label})`).join('\n');
      await Share.share({ message: `Shopping list\n${message}` });
    })} />
    <StoreField label={t('search')} value={search} onChangeText={setSearch} />
    <StoreText muted>{search ? 'Matching products' : 'Low-stock suggestions'}</StoreText>
    {candidates.map(v => <StoreButton key={v.id} secondary label={`Add ${v.product_name} · ${v.label}`} disabled={busy} onPress={() => run(async () => {
      await storeRepository.shopItem(v.id, Math.max(1, (v.low_stock_threshold ?? 0) + 1 - v.stock_quantity)); await load();
    })} />)}
  </StorePage>;
}
