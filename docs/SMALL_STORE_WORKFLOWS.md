# Small-store workflows

The Market theme remains the source of colors, spacing, cards, and text contrast in light and dark mode.

## Daily use

- **Add product:** name, selling price, and starting quantity are visible first. More details contains optional cost, stock alert, barcode, category, and expiration.
- **Product details / Manage variants:** edit selling price, purchase cost, and pieces per pack; pin favorites; review individual expiration batches.
- **Receive delivery:** search or scan several products, enter pieces or configured packs, supplier, per-piece costs, and an expiration date per delivery row. Save all rows together. The same product can appear more than once for different dates.
- **Count stock:** enter the physical quantity, including zero. Blank items remain unchanged. The app computes differences and rejects a count if stock changed after it was entered.
- **Sell:** filter favorites, add pieces or packs to the same stock balance, type quantities, and use Exact cash. Utang requires a customer. New customers and partial repayments are managed under More > Utang.
- **Home:** low-stock and expiration counts open filtered inventory. Weekly backup reminders appear in the app and can be disabled on Backup & Restore.
- **Shopping list:** add low-stock suggestions or search for other products, save desired quantities, mark items bought, and share remaining items. Marking bought does not change stock; receive the actual delivery separately.
- **Daily closing:** compare cash, e-wallet, card/other sales, credit issued, repayments, expenses, and actual counted cash. Opening cash, cash sales, cash repayments, and cash outflows determine expected cash. Stock purchases and owner withdrawals affect cash without being counted again as operating expenses.
- **Language / Wika:** More switches core navigation and action labels between English and Filipino. Product names and entered notes are preserved as typed.

Packs use the configured number of pieces at the ordinary per-piece selling price. Existing independent variants are preserved; the upgrade does not guess which old variants should share stock. Undated batches are consumed after dated batches. Voiding a sale restores the original batch allocations. Fully or partially repaid credit cannot be voided if it would create a negative customer balance; resolve the customer refund first.

## Data compatibility

Schema V5 is an additive, transactional migration. It preserves catalog IDs, stock ledger, sale and cost snapshots, image paths/framing, settings, and the existing database filename. Existing positive balances become a batch with their existing expiration date; pack size defaults to one and favorites are initially off. Migrations are recorded only after success.

Full backups include the new tables and settings. Legacy V1–V4 backups backfill batches. Newer unsupported backups, malformed numeric data, invalid dates, unsafe image paths, and inconsistent batch totals are rejected. Restore uses the selected external JSON file and requires replacement confirmation. Data replacement is transactional; the cart and saved language/theme are refreshed after restore.

No application ID, version code, signing settings, native project, or release/build script is changed. No APK work is part of this change. An actual installed-app update still needs verification on a device before release.

## Validation

Run `npm ci`, `npx tsc --noEmit`, and `npm test -- --runInBand`. The repository's `.npmrc` preserves the legacy peer resolution used by the existing Expo lockfile. Integration tests require Python 3 on PATH (`PYTHON` may name another executable); they run the production TypeScript workflows against an in-memory SQLite bridge and create no database files.

For sandboxed Windows environments, use `npm test -- --runInBand --cacheDirectory .expo/jest-cache` if the system temporary Jest cache is not writable.

Before release, verify on a device:

1. Open an existing populated installation after updating; compare stock, receipts, photos, framing, and theme.
2. Test the simple product form, expanding optional details, editing prices, and switching core language labels.
3. Receive two products and two dates of one product; count stock upward, downward, and to zero.
4. Sell a pack then a piece; use favorites, direct quantities, Exact cash, and continuous barcode scanning.
5. Record an utang sale, a partial cash repayment, an e-wallet repayment, and an unpaid credit void.
6. Confirm expiration alerts and batch allocations after sale/void, including local midnight and returning from the background.
7. Test shopping-list persistence and sharing, operating expenses versus stock purchases, and daily cash differences.
8. Save a backup outside the app, select that exact file to restore, cancel confirmation, and then restore successfully. Test a legacy backup too.
9. Check keyboard scrolling, large text, small phone widths, light/dark themes, and screen-reader labels.

Screenshots and native visual verification are pending until a device is available. Component tests cover the new forms and checkout interactions; they do not establish native visual correctness.
