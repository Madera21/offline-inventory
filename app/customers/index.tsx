import { parseStoreAmount } from '../../src/utils/quantities';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { storeRepository, CustomerBalance } from '../../src/db/repositories/store.repository';
import { StoreButton, StoreCard, StoreField, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { formatMoney, parseMoneyToMinor } from '../../src/utils/currency';
import { useLabels } from '../../src/store/PreferencesProvider';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof storeRepository.creditHistory>>>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'E-WALLET'>('CASH');
  const [error, setError] = useState('');
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  const load = useCallback(async () => {
    try { setCustomers(await storeRepository.customers()); setError(''); } catch { setError('Could not load customer balances.'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const show = async (id: string) => { const entries = await storeRepository.creditHistory(id); setHistory(entries); setSelected(id); setAmount(''); };
  return <StorePage title={t('credit')}>
    <StoreText muted>Credit sales reduce stock but are not cash collected. Choose Utang and a customer at checkout. Record repayments here.</StoreText>
    {error ? <StoreText>{error}</StoreText> : null}
    <StoreButton secondary label="Refresh customers" onPress={() => void load()} />
    <StoreCard><StoreField label="New customer name" value={name} onChangeText={setName} />
      <StoreButton label="Add customer" disabled={busy} onPress={() => run(async () => { await storeRepository.addCustomer(name); setName(''); await load(); })} />
    </StoreCard>
    {customers.map(customer => <StoreButton key={customer.id} secondary label={`${customer.name} · ${formatMoney(customer.balance_minor)} owed`} onPress={() => run(() => show(customer.id))} />)}
    {selected && <StoreCard>
      <StoreText>{customers.find(customer => customer.id === selected)?.name} · Payment history</StoreText>
      <StoreField label="Payment received (₱)" numeric value={amount} onChangeText={setAmount} />
      <StoreButton secondary label={`Payment method: ${method === 'CASH' ? 'Cash' : 'E-wallet'} · Tap to change`} onPress={() => setMethod(method === 'CASH' ? 'E-WALLET' : 'CASH')} />
      <StoreButton label="Record payment" disabled={busy} onPress={() => run(async () => { await storeRepository.repay(selected, parseStoreAmount(amount), method); await load(); await show(selected); })} />
      {history.map(entry => <StoreText key={entry.id}>{new Date(entry.occurred_at).toLocaleString()} · {entry.note} · {formatMoney(entry.amount_minor)} · {entry.payment_method}</StoreText>)}
    </StoreCard>}
  </StorePage>;
}
