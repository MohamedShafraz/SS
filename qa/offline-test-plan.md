# MSHPOS Store and offline QA plan

Run these checks on a clean Windows 10/11 machine, an upgrade copy containing realistic existing data, and a Microsoft Store private-flight installation. Reviewers create their own first administrator; no default credentials are used.

## Store entitlement

- Active base-app licence opens the app with no second purchase prompt.
- Inactive licence shows the install/purchase message and does not expose the POS server.
- Store service errors show Retry and Exit.
- Test offline-cached, expired/refunded, and flight-account states.
- Confirm an APPX without valid entitlement fails closed; confirm the backward-compatible NSIS build remains usable without package identity.

## Setup, auth, and authorization

- A clean installation contains zero users and no business/customer data.
- Complete business/admin setup; race two setup requests and confirm only one administrator is created.
- Test login, logout, expiry, invalid credentials, and session restoration.
- Test every protected page/API as unauthenticated, cashier, manager, and admin.
- Confirm cross-origin mutations and unauthorized maintenance requests are rejected.

## Data integrity and upgrades

- Upgrade an existing database and compare users/password hashes, settings, inventory, transactions, barcode presets, and printer settings before and after.
- Fault-inject checkout and return processing; verify sale/refund, items, payments, and stock all roll back together.
- Test concurrent sales against limited stock.
- Restore valid and corrupted backups; confirm integrity checks, recovery backup, atomic replacement, and automatic recovery on reopen failure.
- Confirm a second Electron instance is rejected before SQLite opens.

## Printing

- GA-2408T uses vertical roll feed with the fixed 102 × 25 mm physical page, three 31.33 × 25 mm labels, and two 4 mm gaps.
- Print 1, 2, 3, 4, and 6 copies: fill left-to-right, then continue on the next row.
- Confirm upright content, 100% scale, no margins, and barcode text sizes at minimum/default/maximum.
- Compare Settings preview, sample PDF, and direct print field order, visibility, fonts, and barcode text.
- Confirm old saved GA orientation values are accepted and ignored, while non-GA layouts preserve orientation behavior and render human-readable barcode text once.

## Package and certification gate

- Run production build, TypeScript, lint, automated tests, and production dependency audit with no critical/high findings.
- Scan unpacked and final APPX/MSIX contents for `.env*`, SQLite/WAL files, customer data, private keys/certificates, known accounts/passwords, and secret markers.
- Confirm no runtime Supabase, Stripe, custom activation, or cloud synchronization request occurs.
- Verify the public HTTPS privacy-policy URL and monitored `mshpos@proton.me` contact.
- Confirm Partner Center identity, publisher, and a version greater than the latest submission.
- Run Windows App Certification Kit against the exact final artifact, upload that artifact to a private flight, then promote the same tested artifact.
- Test install, launch, upgrade, backup/restore, printing, and uninstall-data warning on a clean machine.
