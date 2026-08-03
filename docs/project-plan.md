# Offline Windows POS Project Plan

## Summary

Convert the current Next.js POS into a Windows desktop app that can run offline for the client after one-time activation. The finished client build must not depend on Supabase, Vercel, or Stripe at runtime. Business data moves to local SQLite, auth remains role-based, and the client receives an installer or portable Windows build rather than a shareable web URL or source project.

The `.agents/AGENT.md` roster is reused for ownership boundaries only. Its freelancer proposal product context is outdated for this repository and must not steer POS feature decisions.

## Product Decisions

- Target app: Windows desktop POS packaged from the existing Next.js app.
- Runtime data: local SQLite database stored in the app data directory.
- Activation: one-time online license activation before first login, then offline use.
- License binding: signed local license tied to the Windows machine fingerprint.
- First launch flow: activation screen, then first-admin setup if no local users exist, then normal login.
- Removed client flows: `/register`, `/payment`, Stripe checkout, Stripe plan purchase, and Stripe API runtime behavior.
- Kept POS flows: dashboard, products, variants, barcode search, checkout, transactions, returns, replacement items, settings, receipts, users, roles, and local reports.
- Data safety: provide backup/export and restore/import for the SQLite database.

## Agent Ownership

- Lead Agent owns project-level decisions and this plan.
- Backend Agent owns local SQLite data access, migrations, local APIs, auth persistence, backup/restore, and removal of Supabase/Stripe runtime behavior.
- Frontend Agent owns activation, first-admin setup, offline UI routing, POS screens, and hiding removed payment/register flows.
- Cyber Security Agent owns license verification design, machine binding, tamper behavior, local auth risk review, backup/restore risk review, and security docs.
- QA Agent owns offline acceptance coverage, packaged Windows validation, removed-route checks, and end-to-end POS workflow tests.
- Business and Marketing Strategist Agent owns client handoff docs, support terms, backup instructions, renewal/upgrade policy, and practical license wording.

## Implementation Targets

- Add an Electron or equivalent Windows desktop shell that runs the Next.js UI locally.
- Add a SQLite layer with migrations matching the active POS schema: products, product variants, transactions, transaction items, returns, return items, replacement items, users, settings, licenses, and any required local metadata.
- Replace direct `src/lib/supabase.ts` usage with local repository/API calls.
- Keep `bcryptjs` password hashing and JWT/cookie session behavior, but authenticate against local SQLite users.
- Add local activation state APIs and block protected POS routes until the local signed license is valid.
- Add first-admin setup when activation is valid and the users table is empty.
- Remove Stripe package usage from offline runtime paths and prevent payment/register routes from being reachable in the packaged app.
- Store product images locally, using app data files or existing data URL support where appropriate.
- Add backup/export and restore/import APIs with clear error handling and admin-only access.

## Glossary

- Activation: the one-time online step where a license key is validated and signed for this machine.
- Local license: the signed license payload stored locally and verified on every launch.
- Machine binding: tying the local license to stable Windows machine identifiers so copying the app/database does not activate another machine.
- Offline database: the SQLite database used for all POS business data after activation.
- Backup file: an exported copy of the local SQLite database for client-controlled recovery or migration.

## Acceptance Criteria

- A clean Windows machine can install or run the packaged POS app.
- First launch requires activation before login.
- After activation, the full POS works with no internet connection.
- Copying the app or database to another machine fails license verification.
- Admin setup appears only when there are no local users.
- Admin, manager, and cashier roles continue to restrict access as currently intended.
- Product CRUD, variant stock, barcode lookup, checkout, stock deduction, returns, replacements, receipts, dashboard metrics, transactions, users, settings, backup, and restore work against SQLite.
- `/register`, `/payment`, and Stripe API flows are inaccessible or removed in the offline build.
- No runtime calls are made to Supabase, Vercel, or Stripe after activation.

## Verification Plan

- Run lint and build after each vertical slice.
- Test local migrations on a fresh SQLite database and an existing exported dataset.
- Test activation success, invalid key, tampered license, offline relaunch, and machine mismatch.
- Test first-admin setup, login, logout, and role redirects.
- Test all major POS workflows against SQLite.
- Test backup/export and restore/import using admin access.
- Validate the packaged Windows build outside the development environment.
