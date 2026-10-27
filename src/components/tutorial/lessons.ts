export const lessons = [
  { id: 'catalog', title: 'Build your shelf', icon: 'cube-outline', screen: 'Add Product', route: '/products/new',
    task: 'Create a sample product with a price and starting quantity.',
    tip: 'Use More details for costs, categories, barcodes, and expiration dates.' },
  { id: 'photo', title: 'Change a product photo', icon: 'image-outline', screen: 'Edit Product', route: '/(tabs)/inventory',
    task: 'Choose a sample photo, adjust its framing, then save it.',
    tip: 'For a saved product, tap Replace photo or Edit Info. Save Changes applies the new photo; going back cancels it.' },
  { id: 'sell', title: 'Make your first sale', icon: 'cart-outline', screen: 'Sell → Checkout', route: '/(tabs)/sell',
    task: 'Add Milk, open checkout, use Exact cash, and confirm the sample sale.',
    tip: '9/10 means nine pieces remain out of ten stocked. Confirming a sale reduces remaining stock; voiding it restores stock.' },
  { id: 'delivery', title: 'Receive a delivery', icon: 'archive-outline', screen: 'Receive delivery', route: '/stock/receive',
    task: 'Receive a pack of six pieces and watch the shelf balance increase.',
    tip: 'Enter cost per piece even when receiving packs. Use another delivery row for stock with a different expiration date.' },
  { id: 'count', title: 'Count what is there', icon: 'clipboard-outline', screen: 'Count stock', route: '/stock/count',
    task: 'Count nine pieces instead of the recorded ten, then save the count.',
    tip: 'Enter the actual shelf quantity, including zero. Leave uncounted products blank. Restocking instead records the quantity being added.' },
  { id: 'expiry', title: 'Spot expired stock', icon: 'calendar-outline', screen: 'Stock → Expired', route: '/(tabs)/inventory',
    task: 'Filter expired stock, inspect the batch, and record sample damage.',
    tip: 'In your real store, use Stock Adjustment → Damage / Defect with reason Expired product. Sales use the earliest dated batch first.' },
  { id: 'credit', title: 'Track utang & payments', icon: 'people-outline', screen: 'Utang', route: '/customers',
    task: 'Record a ₱15 sample credit sale for Ana, then receive a ₱5 payment.',
    tip: 'Choose Pay later / Utang and a customer at checkout. Record repayments under More → Utang using the correct payment method.' },
  { id: 'shopping', title: 'Plan your next purchase', icon: 'list-outline', screen: 'Shopping list', route: '/shopping',
    task: 'Add Milk to the list, mark it bought, then receive the delivery.',
    tip: 'Marking an item bought does not change inventory. Receive the actual delivery separately to increase stock.' },
  { id: 'closing', title: 'Close the day', icon: 'calculator-outline', screen: 'Daily closing', route: '/closing',
    task: 'Compare expected cash with the cash you count, then save.',
    tip: 'Expected cash includes opening cash, cash sales and repayments, minus cash outflows. Record purchases and withdrawals under their correct kinds.' },
  { id: 'backup', title: 'Protect your records', icon: 'cloud-download-outline', screen: 'Backup & Restore', route: '/backup',
    task: 'Create a sample backup and review the sample restore confirmation.',
    tip: 'Save a real full backup outside the app. Restoring replaces current records, so review the selected file and date first. CSV is a catalog export, not a full backup.' },
] as const;

export type LessonId = typeof lessons[number]['id'];
export const TUTORIAL_PROGRESS_KEY = 'tutorial_v2_completed';
export function readTutorialProgress(value: string | null): LessonId[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? lessons.filter(lesson => parsed.includes(lesson.id)).map(lesson => lesson.id) : [];
  } catch { return []; }
}
