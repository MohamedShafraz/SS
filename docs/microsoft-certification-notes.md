# Notes to Certification

Use these notes in Partner Center when resubmitting MSHPOS for Microsoft Store certification.

Important: make sure the Microsoft Store test entitlement is available on the device before resubmission.

## Test Access

MSHPOS is an offline POS desktop app. On first launch, the app shows the Microsoft Store purchase flow if needed, then goes to local admin setup before the login screen. Internet access is required only for the Store entitlement check and first-time setup.

1. Launch MSHPOS.
2. Accept the License & Usage Agreement if prompted.
3. If the Microsoft Store purchase/license prompt appears, continue through the Store test purchase flow.
4. Create the first local admin account if the app is on a fresh install.
5. After setup, sign in with one of these accounts:
   - Admin: `admin@pos.local` / `admin12345`
   - Manager: `manager@pos.local` / `manager12345`
   - Cashier: `worker@pos.local` / `worker12345`

## Primary Functionality To Test

- Products: create/edit products, SKU, generated barcode preview, quantity, price, cost.
- POS: add products to cart, apply discounts, checkout, preview/print receipt.
- Transactions: view completed sales and receipt details.
- Dashboard: view sales/inventory summary.
- Settings: update business profile, receipt layout, barcode prefix, and currency.

## Support Note

If Store licensing fails during certification, the Microsoft Store entitlement or test purchase is not reachable. Contact the developer with the failure message and the tested device name so the entitlement can be checked.
