import { KeyboardModal as Modal } from './KeyboardModal';
import { parseStoreAmount } from '../utils/quantities';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ProductVariant } from '../types';
import { storeRepository } from '../db/repositories/store.repository';
import { minorToDecimalString, parseMoneyToMinor } from '../utils/currency';
import { wholeQuantity } from '../utils/quantities';
import { StoreButton, StoreCard, StoreField, StorePage, useStoreAction } from './StoreForm';
import { useLabels } from '../store/PreferencesProvider';

export function VariantSettings({ variant, onSaved }: { variant: ProductVariant; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [pack, setPack] = useState('1');
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  return <>
    <StoreButton secondary label="Edit price / pack size" onPress={() => {
      setPrice(minorToDecimalString(variant.price_minor)); setCost(variant.cost_minor === null ? '' : minorToDecimalString(variant.cost_minor));
      setPack(String(variant.pack_size ?? 1)); setOpen(true);
    }} />
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <StorePage title={variant.label}><StoreCard>
        <StoreField label={`${t('price')} (₱)`} value={price} onChangeText={setPrice} numeric />
        <StoreField label={`${t('cost')} (₱, optional)`} value={cost} onChangeText={setCost} numeric />
        <StoreField label={t('packSize')} value={pack} onChangeText={setPack} numeric />
        <StoreButton label={t('save')} disabled={busy} onPress={() => run(async () => {
          await storeRepository.updateVariant(variant.id, parseStoreAmount(price), cost.trim() ? parseStoreAmount(cost) : null, wholeQuantity(pack));
          await onSaved(); setOpen(false);
        })} />
        <StoreButton label={t('cancel')} secondary disabled={busy} onPress={() => setOpen(false)} />
      </StoreCard></StorePage>
    </Modal>
  </>;
}
