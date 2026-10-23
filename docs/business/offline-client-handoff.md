# Customer handoff

MSHPOS stores products, staff accounts, inventory, transactions, settings, and backups locally on the Windows device. Normal POS work does not require Supabase, Stripe, Vercel, or cloud synchronization. Microsoft Store editions may contact Windows Store services to validate the paid base-app entitlement.

## New installation

1. Install MSHPOS from its approved distribution channel.
2. Enter the business details in the first-run wizard.
3. Let the business owner create the first administrator with their own strong password.
4. The administrator may then create manager and cashier accounts.
5. Configure receipt and barcode printers and create a first backup.

Never send a default password, database, customer record, licence key, or secret with the installer.

## Upgrade

Install the update without deleting the Electron user-data directory. Existing users, hashes, business settings, products, stock, transactions, barcode presets, printer settings, and legacy records remain available. Create and retain an external backup before upgrading.

## Backup and uninstall warning

Backups can contain personal and business information. Store them in a restricted location and remove obsolete copies according to the customer's retention policy. Export and verify a backup before uninstalling or clearing application data; uninstall/data-reset behavior can remove the only local copy.

Support: mshpos@proton.me
