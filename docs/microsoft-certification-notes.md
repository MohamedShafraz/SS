# Notes to Certification

Use these notes in Partner Center when resubmitting MSHPOS for Microsoft Store certification.

Important: make sure the Microsoft Store test entitlement is available on the device before resubmission.

## Test Access

MSHPOS is an offline POS desktop app sold as a one-time paid Microsoft Store app. On first launch, it verifies the base-app Store licence, then opens local business and administrator setup. Daily POS data remains on the device.

1. Launch MSHPOS.
2. Accept the License & Usage Agreement if prompted.
3. The Store test account must already own the paid app; there is no second in-app purchase.
4. On a fresh installation, enter test business details and create a local administrator using credentials chosen by the reviewer.
5. Sign in with that local administrator. Additional manager and cashier accounts can be created from the Users section.

## Primary Functionality To Test

- Products: create/edit products, SKU, generated barcode preview, quantity, price, cost.
- POS: add products to cart, apply discounts, checkout, preview/print receipt.
- Transactions: view completed sales and receipt details.
- Dashboard: view sales/inventory summary.
- Settings: update business profile, receipt layout, barcode prefix, and currency.
- Barcode printing: the GA-2408T preset uses vertical roll feed on its fixed 102 x 25 mm three-column media; copies fill left-to-right without rotating label content.

## Upgrade And Privacy

- Installing an update preserves the existing local SQLite database, users, settings, products, transactions, barcode presets, and printer settings.
- A clean installation contains no users or customer data and opens first-run setup.
- The public privacy-policy URL submitted in Partner Center describes local storage, Store entitlement checks, backups, retention, and deletion.
- Customers should export a backup before uninstalling or clearing application data.

## Support Note

If Store licensing fails during certification, confirm that the certification account owns the paid app and that Windows can reach Microsoft Store licensing. Contact mshpos@proton.me with the failure message and tested device name.
