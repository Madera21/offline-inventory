import { parseStoreAmount } from '../../src/utils/quantities';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { storeRepository } from '../../src/db/repositories/store.repository';
import { reportsRepository } from '../../src/db/repositories/reports.repository';
import { StoreButton, StoreCard, StoreField, StorePage, StoreText, useStoreAction } from '../../src/components/StoreForm';
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from '../../src/utils/currency';
import { useLocalDate } from '../../src/utils/useLocalDate';
import { useLabels } from '../../src/store/PreferencesProvider';
import { ReportCalendar } from '../../src/components/ReportCalendar';
import { localDateKey } from '../../src/utils/dates';

export default function ClosingScreen() {
  const now = useLocalDate();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const day = localDateKey(selectedDate ?? now);
  const historical = day !== localDateKey(now);
  const request = useRef(0);
  const [loading, setLoading] = useState(true);
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
    const current = ++request.current;
    setLoading(true);
    try {
      const start = new Date(`${day}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + 1);
      const [totals, report, float, actual] = await Promise.all([storeRepository.closing(start.toISOString(), end.toISOString()),
        reportsRepository.getSalesReport(start.toISOString(), new Date(end.getTime() - 1).toISOString()), storeRepository.setting(`opening:${day}`), storeRepository.setting(`counted:${day}`)]);
      if (current !== request.current) return;
      setSummary(totals); setProfit({ gross: report.estimatedGrossProfitMinor, missing: report.incompleteCostCount });
      setOpening(float === null ? '' : minorToDecimalString(Number(float))); setCounted(actual === null ? '' : minorToDecimalString(Number(actual))); setError('');
    } catch { if (current === request.current) { setSummary(null); setError('Could not load the daily closing.'); } }
    finally { if (current === request.current) setLoading(false); }
  }, [day]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const expected = parseMoneyToMinor(opening) + (summary?.cash ?? 0) + (summary?.cashPayments ?? 0) - (summary?.cashExpenses ?? 0);
  return <StorePage title={`${t('closing')} · ${day}`}>
    <StoreButton secondary label="Today" disabled={busy || loading} onPress={() => {
      if (day === localDateKey(now)) void load();
      else setSummary(null);
      setSelectedDate(null);
      setCalendarVisible(false);
    }} />
    <StoreButton secondary label="Choose closing day" disabled={busy || loading} onPress={() => setCalendarVisible(visible => !visible)} />
    {calendarVisible && <ReportCalendar selectedDate={selectedDate ?? now} onSelect={date => {
      if (localDateKey(date) !== day) setSummary(null);
      setSelectedDate(date); setCalendarVisible(false);
    }} />}
    {historical && <StoreText muted>Reviewing a previous day. Saved counts are shown below; expenses and closing counts can be recorded for today.</StoreText>}
    {error ? <StoreText>{error}</StoreText> : null}
    <StoreButton secondary label="Refresh totals" disabled={busy || loading} onPress={() => void load()} />
    {loading && <StoreText>Loading closing…</StoreText>}
    {!loading && summary && <StoreCard>
      <StoreText>Cash sales: {formatMoney(summary.cash)}</StoreText><StoreText>E-wallet sales: {formatMoney(summary.wallet)}</StoreText>
      <StoreText>Card / other sales: {formatMoney(summary.other)}</StoreText><StoreText>New utang: {formatMoney(summary.credit)}</StoreText>
      <StoreText>Utang payments collected: {formatMoney(summary.payments)}</StoreText><StoreText>Operating expenses: {formatMoney(summary.expenses)}</StoreText>
      <StoreText>Estimated gross profit less operating expenses: {formatMoney(profit.gross - summary.expenses)}</StoreText>
      {profit.missing > 0 && <StoreText muted>Some costs are missing; the profit estimate is incomplete.</StoreText>}
      {historical ? <StoreText>Opening cash / float: {opening === '' ? 'Not recorded' : formatMoney(parseMoneyToMinor(opening))}</StoreText>
        : <StoreField label="Opening cash / float (₱)" numeric value={opening} onChangeText={setOpening} />}
      <StoreText>Expected cash: {formatMoney(expected)}</StoreText>
      {historical ? <StoreText>Cash counted at closing: {counted === '' ? 'Not recorded' : formatMoney(parseMoneyToMinor(counted))}</StoreText>
        : <StoreField label="Cash counted at closing (₱)" numeric value={counted} onChangeText={setCounted} />}
      {counted.trim() && <StoreText>Cash difference: {formatMoney(parseMoneyToMinor(counted) - expected)}</StoreText>}
      <StoreText muted>Expected cash = opening cash + cash sales + cash utang payments − cash operating expenses. Record cash used for stock purchases or owner withdrawals as cash outflows below; these are not operating expenses.</StoreText>
      {!historical && <StoreButton label="Save closing counts" disabled={busy} onPress={() => run(async () => {
        await storeRepository.setSetting(`opening:${day}`, String(parseStoreAmount(opening || '0')));
        await storeRepository.setSetting(`counted:${day}`, String(parseStoreAmount(counted))); await load();
      })} />}
    </StoreCard>}
    {!historical && <StoreCard><StoreText>Record expense / cash outflow</StoreText>
      <StoreButton secondary label={`Type: ${kind.replace('_', ' ')} · Tap to change`} onPress={() => setKind(kind === 'OPERATING' ? 'STOCK_PURCHASE' : kind === 'STOCK_PURCHASE' ? 'WITHDRAWAL' : 'OPERATING')} />
      <StoreField label="Expense description" value={description} onChangeText={setDescription} />
      <StoreField label="Amount (₱)" numeric value={amount} onChangeText={setAmount} />
      <StoreButton secondary label={`Paid by: ${method} · Tap to change`} onPress={() => setMethod(method === 'CASH' ? 'E-WALLET' : 'CASH')} />
      <StoreButton label="Save expense" disabled={busy} onPress={() => run(async () => { await storeRepository.expense(description, parseStoreAmount(amount), method, kind); setDescription(''); setAmount(''); await load(); })} />
    </StoreCard>}
  </StorePage>;
}
