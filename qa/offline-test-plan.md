# Offline Windows POS QA Test Plan

## Purpose

Validate that the POS conversion behaves as a Windows desktop app that can run fully offline after one-time activation. This plan focuses on acceptance testing for license activation, local SQLite-backed operation, auth, inventory, sales, returns, backups, removed cloud/payment routes, and packaged Windows smoke tests.

## Test Environment

- Windows 10 or Windows 11 clean test machine.
- Packaged POS installer or portable `.exe`.
- Fresh local app data directory with no existing license or database.
- Second Windows machine or VM for machine-binding checks.
- Activation API reachable for online activation tests.
- Network disabled for offline tests after activation.
- Test license keys:
  - valid unused key
  - invalid key
  - expired or revoked key, if supported
  - already-bound key
- Test user roles: admin, manager, cashier.
- Seed products with and without variants, including barcodes and low stock quantities.

## Activation And License Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| ACT-01 | First launch without license | Install and open the app with empty app data. | Activation screen appears before login; POS screens are inaccessible. |
| ACT-02 | Invalid license key | Enter an invalid key and submit. | Activation fails with a clear retry message; no local license is stored. |
| ACT-03 | Valid one-time activation | Connect internet, enter a valid unused key, submit activation. | App stores a signed local license, advances to first-admin setup or login, and records the machine binding. |
| ACT-04 | Offline launch after activation | Close app, disable network, reopen app. | License verifies locally and app opens without contacting activation, Supabase, Vercel, or Stripe. |
| ACT-05 | Tampered license payload | Modify or corrupt the stored license file/database row. | App blocks POS access and returns to activation/retry UI. |
| ACT-06 | Expired or revoked license | Use an expired/revoked license fixture where supported. | App blocks POS access and shows the configured license failure state. |
| ACT-07 | Activation service unavailable | Remove local license, connect to a blocked/unreachable activation API, submit key. | App shows a network/activation unavailable error and remains locked. |

## Machine Binding Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| MB-01 | Copy app data to another machine | Activate on machine A, copy app data/database/license to machine B, launch offline. | App rejects the copied license because fingerprint does not match. |
| MB-02 | Reuse bound key on another machine | Activate valid key on machine A, then try the same key on machine B online. | Activation API rejects reuse or reports already bound. |
| MB-03 | Minor machine changes | Activate on machine A, then change non-critical values such as hostname if supported by the fingerprint design. | Expected behavior matches security design: either still valid within tolerance or clearly requires reactivation. |

## Local Auth Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AUTH-01 | First admin setup | After activation with an empty users table, create the first admin. | Admin account is created locally with a hashed password; user lands in the app. |
| AUTH-02 | Login offline | Disable network and log in with valid local admin credentials. | Login succeeds without external requests. |
| AUTH-03 | Invalid password | Attempt login with the wrong password. | Login fails without revealing whether the account exists. |
| AUTH-04 | Role access | Log in as cashier, manager, and admin. | Role restrictions match existing POS behavior for protected areas and user management. |
| AUTH-05 | User CRUD | As admin, create, deactivate, reactivate, and reset password for local users. | Changes persist in SQLite and are enforced on next login. |
| AUTH-06 | Session persistence | Log in, close app, reopen app. | Session behavior matches product decision: either remains logged in securely or requires login again. |

## Product And Variant CRUD Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| PROD-01 | Create product | Add name, category, price, cost, quantity, SKU, barcode, and image. | Product is saved locally and appears in products and POS search. |
| PROD-02 | Edit product | Update price, cost, quantity, category, SKU, and barcode. | Updated values persist after reload and app restart. |
| PROD-03 | Delete product | Delete a product that has no completed transactions. | Product is removed or archived according to implementation rules. |
| PROD-04 | Product validation | Try blank name, negative price, duplicate SKU, and duplicate barcode. | Validation blocks invalid data with clear messages. |
| PROD-05 | Create variant | Add size/color variant with SKU, barcode, quantity, price adjustment, and optional image. | Variant appears under product and is searchable/scannable. |
| PROD-06 | Edit variant stock | Change variant stock manually. | Variant quantity persists and product-level totals stay consistent with the chosen data model. |
| PROD-07 | Barcode lookup | Scan or type product and variant barcodes in POS. | Correct product or variant is selected; duplicate barcodes are impossible. |

## Checkout And Stock Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| SALE-01 | Cash checkout | Add products to cart, apply discount/tax if supported, complete cash payment. | Transaction and transaction items are saved locally; receipt is available. |
| SALE-02 | Variant checkout | Add a variant to cart and complete checkout. | Variant stock decreases, not the wrong variant. |
| SALE-03 | Mixed cart checkout | Sell product-only items and variant items together. | Totals, stock deductions, and receipt item labels are correct. |
| SALE-04 | Insufficient stock | Try to sell more than available product or variant stock. | Checkout is blocked or quantity is limited according to implementation rules. |
| SALE-05 | Offline checkout | Disable network, complete checkout. | Checkout works with no failed external requests. |
| SALE-06 | Transaction history | Complete sale, open transactions, inspect details. | Transaction appears with correct date, payment method, items, discounts, taxes, and totals. |
| SALE-07 | Dashboard metrics | Complete several sales across categories. | Dashboard totals, counts, revenue, profit/loss, and low-stock views update from local data. |
| SALE-08 | Receipt output | Print/download a receipt after checkout. | Receipt contains correct business settings, items, totals, payment method, and transaction ID. |

## Returns And Replacements Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| RET-01 | Full return | Return all items from a completed transaction. | Return record and return items are saved; returned stock is restored correctly. |
| RET-02 | Partial return | Return only part of a transaction item quantity. | Only returned quantity is restored and return totals are correct. |
| RET-03 | Variant return | Return a variant item. | Correct variant stock is restored. |
| RET-04 | Replacement equal value | Return an item and select replacement items with equal value. | Replacement transaction is linked to return and stock updates both sides correctly. |
| RET-05 | Replacement price difference | Return an item and select higher/lower value replacement. | Difference due/refund is calculated according to product rules. |
| RET-06 | Invalid return | Try returning more quantity than was sold or returning the same item twice beyond available return quantity. | App blocks invalid return. |
| RET-07 | Cancelled return | Start then cancel a return where supported. | No stock or transaction changes remain, or cancelled status is accurately recorded. |

## Backup And Restore Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| BAK-01 | Export backup | Create products, users, sales, returns, and settings, then export backup. | Backup file is created and contains all expected local data. |
| BAK-02 | Restore backup | Reset app data, activate/license as required, restore backup. | Products, variants, users, settings, transactions, returns, and replacements are restored. |
| BAK-03 | Restore invalid file | Attempt restore with a non-backup or corrupted file. | Restore is rejected without damaging existing data. |
| BAK-04 | Backup across app restart | Restore backup, close and reopen app. | Restored data persists. |
| BAK-05 | Backup security expectations | Inspect whether backup includes password hashes and license data. | Behavior matches security design and is documented for client handoff. |

## Removed Cloud Payment And Registration Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| OFF-01 | Register page removed | Navigate directly to `/register`. | Route is unavailable, redirects to activation/login, or shows a controlled not-found state. |
| OFF-02 | Payment page removed | Navigate directly to `/payment`. | Route is unavailable, redirects to activation/login, or shows a controlled not-found state. |
| OFF-03 | Stripe API routes removed | Call `/api/payments/stripe/create-session`, `/complete`, `/cancel-plan`, `/create-plan-session`, and `/complete-plan`. | Routes are absent or return controlled 404/410 responses in offline build. |
| OFF-04 | Stripe UI hidden | Inspect landing, login, POS checkout, and settings screens. | No Stripe checkout, plan purchase, subscription, or online payment UI remains. |
| OFF-05 | Supabase runtime removed | Run app offline and inspect logs/network. | No runtime calls are made to Supabase; missing Supabase env vars do not break offline operation. |
| OFF-06 | Vercel dependency removed | Run packaged app without Vercel hosting or internet. | App still serves UI and local API successfully. |

## Windows Packaged Build Smoke Tests

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| WIN-01 | Clean install | Install packaged Windows build on a clean machine. | Installer completes and app launches. |
| WIN-02 | Portable launch | If portable build exists, launch `.exe` from a normal user directory. | App starts without requiring source files or dev server. |
| WIN-03 | App data location | Create data, close app, locate app data/database path. | Database, license, images, and backups are stored in the expected user-writable location. |
| WIN-04 | No source exposure | Inspect installation directory. | Source project files, `.env`, service-role secrets, and private activation secrets are not included. |
| WIN-05 | Restart persistence | Create product and sale, restart Windows, reopen app. | Data and license persist. |
| WIN-06 | Offline startup | Disable all network adapters, restart app. | Activated app starts and operates normally. |
| WIN-07 | Printer/receipt smoke | Print or save receipt from packaged app. | Output works from packaged context. |
| WIN-08 | Uninstall behavior | Uninstall app. | App binaries are removed; data retention/deletion behavior matches product decision. |

## Static And Automated Checks

- Run `npm run lint` and record any failures.
- Run `npm run build` before packaging and record any failures.
- Search packaged/offline source for forbidden runtime dependencies:
  - `NEXT_PUBLIC_POS_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `stripe.checkout`
  - `/api/payments/stripe`
- Verify the offline build does not require `.env` values for Supabase or Stripe.
- Use OS-level firewall or network adapter disablement during offline test passes.
- Use browser/devtools or app logs to confirm there are no failed network calls during normal POS workflows after activation.

## Acceptance Criteria

- A valid license activates once online and verifies locally afterward.
- Activated POS workflows continue offline across app restarts.
- Copied license/app data cannot be used on a different machine.
- Local auth, products, variants, checkout, stock, returns, replacements, dashboard, receipts, backup, and restore work from SQLite.
- Register, payment, Stripe, Supabase, and Vercel runtime dependencies are removed from the offline client experience.
- Packaged Windows build runs on a clean machine without source files or development services.
