# Production setup

For a new installation, launch MSHPOS and use the guided setup screen to enter the business details and create the first local administrator. Reviewers and customers choose their own strong password; no default credentials are shipped.

For an upgrade, install over the existing application and keep the Electron user-data directory intact. Existing users, password hashes, inventory, transactions, settings, barcode presets, printer settings, and legacy nullable fields remain readable.

Before release, publish the privacy policy at the HTTPS URL supplied to the Store build, verify `mshpos@proton.me` is monitored, test backup/restore, and complete the Store release checklist.
