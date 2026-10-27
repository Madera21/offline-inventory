import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { formatMoney, parseMoneyToMinor } from '../../utils/currency';
import { StoreButton, StoreCard, StoreField, StoreText } from '../StoreForm';
import { StockBadge } from '../StockBadge';
import { LessonId } from './lessons';

function PriceRow({ label, amount }: { label: string; amount: number }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><StoreText>{label}</StoreText><StoreText>{formatMoney(amount)}</StoreText></View>;
}
function Result({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View accessibilityLiveRegion="polite" style={{ padding: 14, borderRadius: 8, backgroundColor: colors.successSoft, gap: 6 }}>
    <Ionicons name="checkmark-circle" size={24} color={colors.success} /><StoreText>{children}</StoreText>
  </View>;
}
const validMoney = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim());
const validCount = (value: string) => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value));

/** Isolated practice state. These screens never call inventory, sales, or backup services. */
export function TutorialPractice({ lesson, onComplete }: { lesson: LessonId; onComplete: () => void }) {
  const { colors } = useTheme();
  const [stage, setStage] = useState(0);
  const [name, setName] = useState('Milk');
  const [price, setPrice] = useState('25.00');
  const [quantity, setQuantity] = useState('10');
  const [photo, setPhoto] = useState('');
  const [zoom, setZoom] = useState(1);
  const [cart, setCart] = useState(0);
  const [cash, setCash] = useState('');
  const [packs, setPacks] = useState(false);
  const [filter, setFilter] = useState('All');
  const [balance, setBalance] = useState(0);
  const [payment, setPayment] = useState('5.00');
  const [counted, setCounted] = useState('');
  const complete = () => { setStage(3); onComplete(); };
  const sampleItem = (remaining = 10, total = 10, productName = 'Milk', amount = 2500) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
    <View style={{ width: 60, height: 70, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="cafe-outline" size={32} color={colors.accent} />
    </View>
    <View style={{ flex: 1, gap: 5 }}><StoreText>{productName} · Piece</StoreText><StoreText>{formatMoney(amount)}</StoreText><StockBadge quantity={remaining} totalStocked={total} unitLabel="pieces" /></View>
  </View>;

  if (lesson === 'catalog') return <StoreCard>
    {stage === 3 ? <><Result>Product saved to your practice shelf.</Result>{sampleItem(Number(quantity), Number(quantity), name, parseMoneyToMinor(price))}</> : <>
      <StoreField label="Sample product name" value={name} onChangeText={setName} />
      <StoreField label="Sample selling price (₱)" value={price} onChangeText={setPrice} numeric />
      <StoreField label="Sample starting quantity" value={quantity} onChangeText={setQuantity} numeric />
      <StoreButton label="Save sample product" disabled={!name.trim() || !validMoney(price) || parseMoneyToMinor(price) <= 0 || !validCount(quantity)} onPress={complete} />
    </>}
  </StoreCard>;

  if (lesson === 'photo') return <StoreCard>
    <View style={{ height: 170, overflow: 'hidden', borderRadius: 8, backgroundColor: photo === 'green' ? colors.successSoft : photo === 'gold' ? colors.warningSoft : colors.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={photo ? 'cafe-outline' : 'image-outline'} size={56 * zoom} color={photo ? colors.accent : colors.muted} />
    </View>
    {stage === 3 ? <Result>New photo and framing saved. Your product details stay the same.</Result> : <>
      <StoreButton label="Choose sample photo" onPress={() => setStage(1)} />
      {stage === 1 && <><StoreText>Sample gallery · Tap a thumbnail</StoreText><View style={{ flexDirection: 'row', gap: 10 }}>
        {(['cream', 'green', 'gold'] as const).map(tone => <TouchableOpacity key={tone} accessibilityRole="button" accessibilityLabel={`Choose ${tone} sample photo`}
          onPress={() => { setPhoto(tone); setStage(2); }} style={{ flex: 1, padding: 18, alignItems: 'center', borderRadius: 8, backgroundColor: tone === 'green' ? colors.successSoft : tone === 'gold' ? colors.warningSoft : colors.soft }}>
          <Ionicons name="cafe-outline" size={30} color={colors.accent} />
        </TouchableOpacity>)}
      </View></>}
      {photo && <><StoreText>Framing · Zoom {zoom.toFixed(1)}×</StoreText>
        <StoreButton secondary label="Zoom sample photo" onPress={() => setZoom(value => value >= 1.6 ? 1 : Math.round((value + 0.2) * 10) / 10)} />
        <StoreButton label="Save sample photo" disabled={zoom === 1} onPress={complete} /></>}
    </>}
  </StoreCard>;

  if (lesson === 'sell') return <StoreCard>
    {stage === 3 ? <><Result>Sample sale complete · Receipt DEMO-001</Result>{sampleItem(10 - cart, 10)}<PriceRow label="Total paid" amount={cart * 2500} /></> : stage === 0 ? <>
      {sampleItem()}<StoreButton secondary label={`Add Milk to sample cart (${cart})`} disabled={cart >= 10} onPress={() => setCart(value => value + 1)} />
      <StoreButton label="Open sample checkout" disabled={!cart} onPress={() => setStage(1)} />
    </> : <>
      <StoreText>Current cart · {cart} piece(s) of Milk</StoreText><PriceRow label="Total due" amount={cart * 2500} />
      <StoreField label="Sample cash received (₱)" value={cash} onChangeText={setCash} numeric />
      <StoreButton secondary label="Use sample exact cash" onPress={() => setCash((cart * 25).toFixed(2))} />
      <StoreButton label="Confirm sample sale" disabled={!validMoney(cash) || parseMoneyToMinor(cash) < cart * 2500} onPress={complete} />
    </>}
  </StoreCard>;

  if (lesson === 'delivery') return <StoreCard>
    {stage === 3 ? <><Result>Delivery received · 6 pieces added.</Result>{sampleItem(16, 16)}</> : <>
      {sampleItem()}<StoreText>Delivery row · 1 {packs ? 'pack of 6' : 'piece'}</StoreText>
      <StoreButton secondary label={packs ? 'Using packs · 6 pieces each' : 'Switch sample delivery to packs'} onPress={() => setPacks(!packs)} />
      <PriceRow label="Cost per piece" amount={1800} /><StoreText>{packs ? 6 : 1} piece(s) will be added</StoreText>
      <StoreButton label="Save sample delivery" disabled={!packs} onPress={complete} />
    </>}
  </StoreCard>;

  if (lesson === 'count') return <StoreCard>
    {stage === 3 ? <><Result>Count saved · Difference: {Number(counted) - 10}</Result>{sampleItem(Number(counted), Math.max(10, Number(counted)))}</> : <>
      {sampleItem()}<StoreText muted>Recorded quantity: 10. Count what is actually there.</StoreText>
      <StoreField label="Sample counted quantity" value={counted} onChangeText={setCounted} numeric />
      {validCount(counted) && <StoreText>Difference: {Number(counted) - 10}</StoreText>}
      <StoreButton label="Save sample stock count" disabled={!validCount(counted)} onPress={complete} />
    </>}
  </StoreCard>;

  if (lesson === 'expiry') return <StoreCard>
    {stage === 3 ? <><Result>Expired batch removed from sample stock.</Result>{sampleItem(5, 10)}</> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['All', 'Expiring soon', 'Expired'].map(value =>
        <StoreButton key={value} secondary={filter !== value} label={`Show ${value.toLowerCase()} sample stock`} onPress={() => setFilter(value)} />)}</View>
      {filter !== 'Expiring soon' && <View style={{ padding: 12, backgroundColor: colors.dangerSoft, borderRadius: 7, gap: 8 }}>
        <StoreText>Milk · Batch A · 5 pieces · Expired yesterday</StoreText>
        {filter === 'Expired' && <StoreButton secondary label="Inspect expired sample batch" onPress={() => setStage(1)} />}
      </View>}
      {filter !== 'Expired' && <StoreText>Milk · Batch B · 5 pieces · Expires in 7 days</StoreText>}
      {stage === 1 && <><StoreText>Stock Adjustment · Damage / Defect · 5 pieces</StoreText><StoreText>Reason: Expired product</StoreText><StoreButton label="Record sample damage" onPress={complete} /></>}
    </>}
  </StoreCard>;

  if (lesson === 'credit') return <StoreCard>
    <StoreText>Customer · Ana</StoreText><PriceRow label="Utang balance" amount={balance} />
    {stage === 3 ? <Result>Payment recorded · Ana’s remaining balance is {formatMoney(balance)}.</Result> : stage === 0 ? <>
      <StoreText>Sample credit sale · ₱15.00</StoreText><StoreButton label="Record sample utang for Ana" onPress={() => { setBalance(1500); setStage(1); }} />
    </> : <>
      <StoreField label="Sample repayment (₱)" value={payment} onChangeText={setPayment} numeric /><StoreText>Payment method · Cash</StoreText>
      <StoreButton label="Record sample repayment" disabled={!validMoney(payment) || parseMoneyToMinor(payment) <= 0 || parseMoneyToMinor(payment) > balance} onPress={() => { setBalance(balance - parseMoneyToMinor(payment)); complete(); }} />
    </>}
  </StoreCard>;

  if (lesson === 'shopping') return <StoreCard>
    {sampleItem(stage === 3 ? 7 : 2, stage === 3 ? 15 : 10)}
    {stage === 3 ? <Result>5 purchased pieces received. Stock is now 7/15.</Result> : stage === 0 ? <StoreButton label="Add Milk to sample shopping list" onPress={() => setStage(1)} />
      : stage === 1 ? <><StoreText>Shopping list · Milk · Buy 5 pieces</StoreText><StoreButton label="Mark sample Milk bought" onPress={() => setStage(2)} /></>
        : <><StoreText>✓ Bought · Inventory is still 2/10 until you receive the delivery.</StoreText><StoreButton label="Receive sample shopping delivery" onPress={complete} /></>}
  </StoreCard>;

  if (lesson === 'closing') return <StoreCard>
    <PriceRow label="Opening cash" amount={10000} /><PriceRow label="Cash sales" amount={25000} /><PriceRow label="Cash expenses" amount={3000} />
    <View style={{ height: 1, backgroundColor: colors.line }} /><PriceRow label="Expected cash" amount={32000} />
    {stage === 3 ? <Result>Sample closing saved · Cash difference: {formatMoney(parseMoneyToMinor(counted) - 32000)}.</Result> : <>
      <StoreField label="Sample cash counted (₱)" value={counted} onChangeText={setCounted} numeric />
      {validMoney(counted) && <PriceRow label="Difference" amount={parseMoneyToMinor(counted) - 32000} />}
      <StoreButton label="Save sample closing" disabled={!validMoney(counted)} onPress={complete} />
    </>}
  </StoreCard>;

  return <StoreCard>
    {stage === 3 ? <Result>Backup and restore practice complete. Your real records were not changed.</Result> : <>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><Ionicons name="document-text-outline" size={42} color={colors.accent} />
        <View style={{ flex: 1 }}><StoreText>sample_inventory_backup.json</StoreText><StoreText muted>12 products · 8 sales · 4 photos</StoreText></View></View>
      {stage === 0 ? <StoreButton label="Create sample backup" onPress={() => setStage(1)} /> : stage === 1 ? <>
        <StoreText>✓ Sample archive ready. A real backup should be saved outside the app.</StoreText><StoreButton label="Review sample restore" onPress={() => setStage(2)} />
      </> : <View style={{ backgroundColor: colors.warningSoft, padding: 14, borderRadius: 8, gap: 12 }}>
        <StoreText>Replace current records?</StoreText><StoreText muted>Selected: sample_inventory_backup.json. In the real app, confirmation replaces your current data.</StoreText>
        <StoreButton label="Confirm sample restore" onPress={complete} />
      </View>}
    </>}
  </StoreCard>;
}
