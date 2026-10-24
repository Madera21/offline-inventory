import { parseStoreAmount } from '../../src/utils/quantities';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { storeRepository } from '../../src/db/repositories/store.repository';
import { reportsRepository } from '../../src/db/repositories/reports.repository';
import { StoreButton, StoreCard, StoreField, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from '../../src/utils/currency';
import { useLocalDate } from '../../src/utils/useLocalDate';
import { useLabels } from '../../src/store/PreferencesProvider';

export default function ClosingScreen() {
  const now = useLocalDate();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof storeRepository.closing>> | null>(null);
  const [profit, setProfit] = useState({ gross: 0, missing: 0 });
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'OPERATING' | 'STOCK_PURCHASE' | 'WITHDRAWAL'>('OPERATING');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'E-WALLET'>('CASH');
  const [error, setError] = useState('');
  const { busy, run } = useStoreAction();
  const { t } = useLabels();
  const load = useCallback(async () => {
    try {
      const start = new Date(`${day}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + 1);
      const [totals, report, float, actual] = await Promise.all([storeRepository.closing(start.toISOString(), end.toISOString()),
        reportsRepository.getSalesReport(start.toISOString(), new Date(end.getTime() - 1).toISOString()), storeRepository.setting(`opening:${day}`), storeRepository.setting(`counted:${day}`)]);
      setSummary(totals); setProfit({ gross: report.estimatedGrossProfitMinor, missing: report.incompleteCostCount });
      setOpening(float === null ? '' : minorToDecimalString(Number(float))); setCounted(actual === null ? '' : minorToDecimalString(Number(actual))); setError('');
    } catch { setError('Could not load the daily closing.'); }
  }, [day]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const expected = parseMoneyToMinor(opening) + (summary?.cash ?? 0) + (summary?.cashPayments ?? 0) - (summary?.cashExpenses ?? 0);
  return <StorePage title={`${t('closing')} · ${day}`}>
    {error ? <StoreText>{error}</StoreText> : null}
    <StoreButton secondary label="Refresh totals" onPress={() => void load()} />
    {summary && <StoreCard>
      <StoreText>Cash sales: {formatMoney(summary.cash)}</StoreText><StoreText>E-wallet sales: {formatMoney(summary.wallet)}</StoreText>
      <StoreText>Card / other sales: {formatMoney(summary.other)}</StoreText><StoreText>New utang: {formatMoney(summary.credit)}</StoreText>
      <StoreText>Utang payments collected: {formatMoney(summary.payments)}</StoreText><StoreText>Operating expenses: {formatMoney(summary.expenses)}</StoreText>
      <StoreText>Estimated gross profit less operating expenses: {formatMoney(profit.gross - summary.expenses)}</StoreText>
      {profit.missing > 0 && <StoreText muted>Some costs are missing; the profit estimate is incomplete.</StoreText>}
      <StoreField label="Opening cash / float (₱)" numeric value={opening} onChangeText={setOpening} />
      <StoreText>Expected cash: {formatMoney(expected)}</StoreText>
      <StoreField label="Cash counted at closing (₱)" numeric value={counted} onChangeText={setCounted} />
      {counted.trim() && <StoreText>Cash difference: {formatMoney(parseMoneyToMinor(counted) - expected)}</StoreText>}
      <StoreText muted>Expected cash = opening cash + cash sales + cash utang payments − cash operating expenses. Record cash used for stock purchases or owner withdrawals as cash outflows below; these are not operating expenses.</StoreText>
      <StoreButton label="Save closing counts" disabled={busy} onPress={() => run(async () => {
        await storeRepository.setSetting(`opening:${day}`, String(parseStoreAmount(opening || '0')));
        await storeRepository.setSetting(`counted:${day}`, String(parseStoreAmount(counted))); await load();
      })} />
    </StoreCard>}
    <StoreCard><StoreText>Record expense / cash outflow</StoreText>
      <StoreButton secondary label={`Type: ${kind.replace('_', ' ')} · Tap to change`} onPress={() => setKind(kind === 'OPERATING' ? 'STOCK_PURCHASE' : kind === 'STOCK_PURCHASE' ? 'WITHDRAWAL' : 'OPERATING')} />
      <StoreField label="Expense description" value={description} onChangeText={setDescription} />
      <StoreField label="Amount (₱)" numeric value={amount} onChangeText={setAmount} />
      <StoreButton secondary label={`Paid by: ${method} · Tap to change`} onPress={() => setMethod(method === 'CASH' ? 'E-WALLET' : 'CASH')} />
      <StoreButton label="Save expense" disabled={busy} onPress={() => run(async () => { await storeRepository.expense(description, parseStoreAmount(amount), method, kind); setDescription(''); setAmount(''); await load(); })} />
    </StoreCard>
  </StorePage>;
}
