# Inventory usability fixes

## Stock fractions

Stock badges show remaining pieces / total stocked, for example `10/10`, `9/10`, and `0/10`. The denominator is derived from positive opening-stock, restock, and stock-count adjustment entries in the existing movement ledger. Sales and damage reduce remaining stock; sale voids and customer returns restore stock without counting the same items as a new delivery. The denominator never falls below the recorded remaining quantity, including for legacy data with an incomplete ledger.

The catalog sums active variants. Individual variants show their own totals. No database migration or new backup fields are required.

## Saved product photos

Open a product and tap Add photo / Replace photo, or Edit Info. Choose a photo or take one, adjust framing, and Save Changes. Product details and the primary photo record save in one transaction. Cancelled edits discard new temporary photos; failed saves preserve the draft for retry and leave the existing photo record unchanged. Existing photo files are retained to avoid deleting a file another record may share.

## Interactive tutorial

More & Settings → How to Use contains ten interactive lessons: products, photos, checkout, deliveries, counts, expiration, utang, shopping, closing, and backups. The practice screens use isolated sample state and never call inventory, sales, or backup writes. Only lesson completion is stored in `app_settings` under `tutorial_v2_completed`. Users can resume, repeat a lesson, reset lesson progress, or explicitly open the corresponding real screen.

## Keyboard behavior

Form pages use Keyboard Controller's keyboard-aware scrolling with space above the keyboard. Modal windows have their own keyboard-avoiding layout; long modal forms scroll too. Checkout uses one main form scroller so quantity, discount, and payment fields remain reachable. Horizontal category lists keep ordinary horizontal scrolling. Android explicitly uses resize mode.

Keyboard Controller, Reanimated, and Worklets use Expo SDK 58's compatible versions. Existing standalone installations require a new native APK build; Expo Go for SDK 58 includes the required native modules.

Validation covers ledger totals across sale/void/delivery/return flows, atomic photo updates and rollback, draft cleanup and save races, all practice lessons, and saved tutorial progress. Native visual and keyboard checks are recorded in the PR.

## Android verification

Verified in Expo Go 58.0.5 on an Android 16 / API 36 emulator:

- Completed the tutorial checkout and confirmed its sample stock changed to 9/10 while the real inventory remained empty.
- Created a real product with 10 pieces, added and framed a photo after saving the product, and confirmed the photo persisted.
- Typed in the product notes and checkout payment fields with the keyboard open; the focused fields stayed visible and the checkout save button remained reachable by scrolling.
- Saved the real checkout and confirmed the catalog showed 9/10 alongside the edited photo.

Screenshots are in `docs/screenshots/usability/`. Automated validation: 25 Jest suites / 157 tests, TypeScript, Expo dependency alignment, and Expo Doctor (20/20 checks).
