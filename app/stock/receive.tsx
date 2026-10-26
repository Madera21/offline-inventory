import { parseStoreAmount } from '../../src/utils/quantities';
import React, { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { StoreButton, StoreCard, StoreField, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { ExpirationDateField } from '../../src/components/ExpirationDateField';
import { useStoreCatalog } from '../../src/utils/useStoreCatalog';
import { wholeQuantity } from '../../src/utils/quantities';
import { storeRepository } from '../../src/db/repositories/store.repository';
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from '../../src/utils/currency';
import { useLabels } from '../../src/store/PreferencesProvider';

interface DraftLine { key: number; variantId: string; quantity: string; cost: string; date: string; boxes: boolean }

export default function ReceiveScreen() {
  const { variants, load, error } = useStoreCatalog();
  const [supplier, setSupplier] = useState('');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scanner, setScanner] = useState(false);
  const nextKey = useRef(0);
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  const add = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;
    const line = { key: nextKey.current++, variantId, quantity: '1', cost: variant.cost_minor === null ? '' : minorToDecimalString(variant.cost_minor), date: '', boxes: false };
    setLines(previous => [...previous, line]); setSearch('');
  };
  const change = (key: number, patch: Partial<DraftLine>) => setLines(previous => previous.map(line => line.key === key ? { ...line, ...patch } : line));
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (line.boxes ? variants.find(v => v.id === line.variantId)?.pack_size ?? 1 : 1) * parseMoneyToMinor(line.cost), 0);
  return <StorePage title={t('receive')}>
    <StoreText muted>Add all items in a delivery, then save once. Each row creates its own expiration batch.</StoreText>
    {error ? <StoreText>{error}</StoreText> : null}
    <StoreField label={t('supplier')} value={supplier} onChangeText={setSupplier} />
    <StoreField label={t('search')} value={search} onChangeText={setSearch} />
    <StoreButton secondary label="Scan delivery item" onPress={() => setScanner(true)} />
    {search.trim() ? variants.filter(v => `${v.product_name} ${v.label} ${v.barcode ?? ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 20).map(v => <StoreButton key={v.id} secondary label={`Add ${v.product_name} · ${v.label}`} onPress={() => add(v.id)} />) : <StoreText muted>Search or scan to add items. Add the same item again for a different expiration date.</StoreText>}
    {lines.map(line => {
      const variant = variants.find(v => v.id === line.variantId);
      const multiplier = line.boxes ? variant?.pack_size ?? 1 : 1;
      return <StoreCard key={line.key}>
        <StoreText>{variant?.product_name} · {variant?.label}</StoreText>
        <StoreField label={line.boxes ? 'Number of packs / boxes' : 'Pieces received'} numeric value={line.quantity} onChangeText={value => change(line.key, { quantity: value })} />
        {(variant?.pack_size ?? 1) > 1 && <StoreButton secondary label={line.boxes ? 'Switch to pieces' : `Receive packs (${variant?.pack_size} pieces each)`} onPress={() => change(line.key, { boxes: !line.boxes })} />}
        <StoreText muted>{(Number(line.quantity) || 0) * multiplier} pieces will be added</StoreText>
        <StoreField label={`${t('cost')} (₱, optional)`} numeric value={line.cost} onChangeText={value => change(line.key, { cost: value })} />
        <ExpirationDateField value={line.date} onChangeText={value => change(line.key, { date: value })} />
        <StoreButton secondary label="Remove item" onPress={() => setLines(previous => previous.filter(row => row.key !== line.key))} />
      </StoreCard>;
    })}
    <StoreText>Known purchase cost: {formatMoney(total)}{lines.some(line => !line.cost.trim()) ? ' · Some costs are missing' : ''}</StoreText>
    <StoreButton label={`Save delivery (${lines.length} items)`} disabled={busy || !lines.length} onPress={() => run(async () => {
      await storeRepository.receive(supplier, lines.map(line => ({ variantId: line.variantId,
        quantity: wholeQuantity(line.quantity) * (line.boxes ? variants.find(v => v.id === line.variantId)?.pack_size ?? 1 : 1),
        unitCostMinor: line.cost.trim() ? parseStoreAmount(line.cost) : null, expirationDate: line.date })));
      setLines([]); setSupplier(''); await load(); Alert.alert('Delivery received', 'Stock, costs, and expiration batches have been updated together.');
    })} />
    <BarcodeScannerModal visible={scanner} onClose={() => setScanner(false)} title="Scan delivery items" onScan={code => {
      const variant = variants.find(v => v.barcode === code || v.sku === code);
      if (variant) add(variant.id); else Alert.alert('Not found', 'Add this product to inventory first.');
    }} />
  </StorePage>;
}
