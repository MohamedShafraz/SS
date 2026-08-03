# Offline Client Handoff Guide

## Purpose

This document defines how to hand the Windows offline POS app to a client in a way that is clear, supportable, and honest. The client should understand what they receive, how the license works, what support includes, how to protect their local data, and what "offline" and "cannot share with others" mean in practical terms.

## Client Deliverables

Provide the client with:

- A Windows installer or portable Windows app build.
- One license key issued for the client's shop or business.
- A short setup note with activation steps, backup location, and support contact.
- The agreed support and renewal terms in writing.

Do not provide:

- Source code.
- Supabase, Stripe, Vercel, or developer account credentials.
- Private signing keys, license-generation tools, or activation service secrets.
- A reusable admin/developer build intended for internal testing.

## Installer And License Handoff

Recommended delivery flow:

1. Confirm the client's business name, shop name, primary contact, and target Windows computer.
2. Generate a license key for that client record.
3. Send the installer and license key through separate channels when possible.
4. Ask the client to install the app on the final shop computer.
5. During first launch, the client enters the license key while internet is available.
6. After successful activation, the app stores a local license and can run offline.
7. The client creates the first admin user inside the app.

Build and activation commands are documented in [license-activation-steps.md](../license-activation-steps.md).

Recommended handoff message:

> This POS is delivered as a Windows offline app for your shop computer. It needs internet once for license activation. After activation, sales, products, stock, users, receipts, reports, and settings run from the local computer without depending on a website connection.

License key handling:

- Treat each license key as client-specific.
- Record license key, client name, machine activation date, support term, and renewal date in the seller's license records.
- If the client changes computers, deactivate or replace the old machine binding according to the agreed support policy.
- Do not describe the license as impossible to bypass. Describe it as machine-bound copy protection designed to prevent normal sharing.

## Honest Copy Protection Wording

Use clear wording:

- "The app is licensed for one business computer unless your agreement says otherwise."
- "The license is activated on the Windows computer where the POS will be used."
- "Copying the app or database to another computer will not automatically transfer the license."
- "If you replace your computer, contact support to move or reissue the license."

Avoid overpromising:

- Do not say "cannot be cracked."
- Do not say "impossible to share."
- Do not say "100% secure DRM."
- Do not threaten the client with legal language inside ordinary setup instructions.

Recommended client-facing phrase:

> The app includes practical copy protection so it is licensed to your shop computer, not freely shareable as a public website link. Like any software, no protection is unbreakable, but this setup prevents normal copying and keeps the app simple for offline shop use.

## Support Terms

Define support before delivery. Recommended baseline:

- Installation support: included for the first installation on one Windows computer.
- Activation support: included for the licensed machine.
- Bug fixes: included for issues that stop agreed POS workflows from working as delivered.
- Data help: backup and restore guidance is included; manual data repair or recovery may be billable.
- New features: quoted separately unless included in a maintenance plan.
- Hardware support: barcode scanners, receipt printers, and Windows device issues are supported only for app configuration unless separately agreed.

Recommended response targets:

- Critical sales-blocking issue: same business day where possible.
- Normal bug or setup issue: 1-2 business days.
- Feature request or customization: quote and schedule separately.

Support boundaries:

- The client is responsible for keeping the Windows computer usable, powered safely, and free from malware.
- The client is responsible for regular backups.
- The seller is not responsible for lost sales or lost data if the client has no recent backup.
- If remote support is required, the client must approve access and be present during the session.

## Backup Instructions

Position backup as part of daily shop operations, not a technical afterthought.

Recommended client wording:

> Because this is an offline app, your sales and stock data live on your shop computer. Please back up the POS database regularly. If the computer is damaged, stolen, reset, or infected, the backup is what allows your data to be restored.

Recommended backup policy:

- Daily backup at closing time for active shops.
- Weekly backup for low-volume shops.
- Keep at least three recent backup files.
- Store one copy away from the POS computer, such as a USB drive, external drive, or trusted cloud storage.
- Rename backups with shop name and date, for example `ShopName-POS-backup-2026-07-26`.
- Test restore after initial setup and after major upgrades.

Backup handoff checklist:

- Show the client where the backup/export button is.
- Show where backup files are saved.
- Ask the client to perform one backup during handoff.
- Confirm the client can find the backup file after export.
- Explain that backup files may contain business data and should not be publicly shared.

Restore guidance:

- Restore should only be done when the current POS data needs to be replaced.
- Before restore, create a backup of the current database.
- Use restore for computer replacement, recovery after damage, or rollback from accidental data loss.
- After restore, verify products, stock, transactions, users, settings, and receipts before the shop resumes sales.

## Renewal And Upgrade Policy

Separate license renewal from software upgrades so the client understands what they are paying for.

Possible renewal models:

- Lifetime license with paid support and paid upgrades.
- Annual license that includes support and minor updates while active.
- One-time setup fee plus optional maintenance plan.

Recommended simple model:

- The client buys a license for one Windows computer.
- Minor bug-fix updates are included during the initial support period.
- Major feature upgrades, new reports, multi-branch support, data migration, and custom workflows are quoted separately.
- License transfer to a replacement computer is included once per support term, then billed or reviewed manually.

Upgrade process:

1. Confirm the client's current app version.
2. Ask the client to export a backup before upgrade.
3. Install the update.
4. Open the app and confirm license status.
5. Verify login, products, stock, checkout, receipts, transactions, and reports.
6. Keep the previous installer until the upgrade is confirmed.

Renewal reminder wording:

> Your POS will continue to run offline according to your license terms. Renewing support keeps you covered for help, fixes, compatibility updates, and license transfer support if your computer changes.

## Offline App Positioning

Use this positioning in sales and support conversations:

- Best for shops that need the POS to keep working when internet is slow or unavailable.
- Data is stored locally on the shop computer.
- One-time internet is needed for activation unless a manual activation process is separately offered.
- No public website link is given to the client for daily use.
- The client should not expect real-time cloud sync, multi-device sync, or remote access unless those features are separately built.

Recommended concise offer:

> A Windows offline POS for your shop: install it on your computer, activate the license once, and continue billing, stock handling, receipts, and reports even when the internet is unavailable.

## Handoff Checklist

Before marking delivery complete:

- Installer or portable build is tested on a clean Windows machine.
- License key is generated and recorded against the client.
- Activation succeeds on the client's machine.
- First admin user is created by or with the client.
- The client completes one sample product, sale, receipt, return if relevant, and report check.
- Backup/export is demonstrated and the client creates a first backup.
- Support term, renewal terms, upgrade policy, and license transfer policy are confirmed in writing.
- The client receives the final setup note and support contact.

## Internal Notes For Seller

- Keep license and support records outside the client app.
- Keep activation service credentials and signing keys private.
- Do not rely on copy protection as the only business protection; use clear written terms too.
- Use plain language with small-shop clients. Explain outcomes: "works without internet after activation", "licensed to one computer", and "backups protect your data."
