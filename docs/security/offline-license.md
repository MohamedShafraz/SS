# Offline License Security Plan

This document defines the security contract for converting this POS into an offline Windows app. It is practical for the current Next.js codebase, which currently uses Supabase, Stripe, `bcryptjs` user passwords, JWT cookie sessions, and role-based protected routes.

## Goals

- The POS must run without Supabase, Vercel, or Stripe after activation.
- A client should not be able to copy the app and database to another Windows machine and keep using the same license.
- The desktop app must not contain license-signing secrets, Stripe secrets, Supabase service keys, or activation-admin credentials.
- License failures must fail closed before login and before POS data APIs are usable.

## One-Time Activation

Activation is the only required online step.

1. On first launch, show an activation screen before login.
2. The user enters a license key.
3. The app computes a machine fingerprint locally.
4. The app sends `licenseKey`, `machineFingerprintHash`, `appVersion`, and a one-time random `activationNonce` to the hosted activation service over HTTPS.
5. The activation service validates the key, binds it to that machine if unused, and returns a signed license payload.
6. The desktop app verifies the signature locally using an embedded public key.
7. If valid, store the signed license payload locally and continue to first-admin setup or login.

The activation service owns the private signing key. The desktop app only embeds the public verification key.

## Signed License Payload

Use an asymmetric signature so the app can verify a license offline without carrying a signing secret.

Recommended payload fields:

```json
{
  "licenseId": "lic_...",
  "customerName": "Client business name",
  "machineFingerprintHash": "sha256:...",
  "product": "pos-system-offline",
  "edition": "standard",
  "issuedAt": "2026-07-26T00:00:00.000Z",
  "expiresAt": null,
  "activationNonce": "base64url-random",
  "features": ["pos", "inventory", "returns", "reports", "backup_restore"],
  "schemaVersion": 1
}
```

Recommended envelope:

```json
{
  "payload": { "...": "..." },
  "signatureAlgorithm": "Ed25519",
  "signature": "base64url-signature",
  "keyId": "offline-license-2026-01"
}
```

Implementation requirements:

- Canonicalize the payload before signing and verifying, or use a standard format with stable signing semantics.
- Prefer Ed25519 for small keys and simple verification.
- Pin the expected `product` value to `pos-system-offline`.
- Pin accepted `keyId` values in the app and keep the old public key only for active license rotation windows.
- Reject unsupported `schemaVersion`, unsupported `signatureAlgorithm`, missing fields, expired licenses, and malformed payloads.

## Machine Binding

The app should bind a license to a privacy-preserving hash, not store raw hardware identifiers in the activation service.

Recommended Windows fingerprint inputs:

- Windows MachineGuid from the registry.
- OS installation identifier when available.
- Primary system drive volume serial.
- CPU or motherboard identifier only if accessible without admin privileges.

Rules:

- Normalize each value before hashing.
- Hash the combined fingerprint with SHA-256 and a product-specific salt string compiled into the app.
- Send and store only the hash, for example `sha256:<hex>`.
- Require at least two stable inputs. If only one input is available, activation may proceed but should mark the license as weakly bound in the activation service for support review.
- Do not use MAC address alone because network adapters change often.

Local verification must recompute the current machine fingerprint hash and compare it to the signed `machineFingerprintHash` using constant-time comparison where practical.

## Local License Storage

Store the signed license in the app data directory, not in the source tree or installation directory.

Recommended storage:

- SQLite `licenses` table for current license metadata and signed envelope.
- Optional mirrored license file in Electron `app.getPath("userData")` for recovery diagnostics.

Minimum `licenses` fields:

- `id`
- `license_id`
- `signed_payload`
- `machine_fingerprint_hash`
- `activated_at`
- `last_verified_at`
- `status`

Do not store the raw license key after activation. If support needs to identify the license, store only `licenseId` from the signed payload and a short display suffix of the entered key.

## Runtime Enforcement

License verification must run before normal app access.

Fail closed when:

- No local signed license exists.
- Signature verification fails.
- Payload product, schema, key ID, or algorithm is unsupported.
- Machine fingerprint hash does not match.
- The license is expired, revoked by a fresh online activation check, or marked disabled locally.
- The local license row is missing while a backup restore claims one exists.

When verification fails:

- Clear the auth cookie/session.
- Redirect to activation or a license-error screen.
- Block `/dashboard`, `/pos`, `/products`, `/transactions`, `/settings`, local data APIs, backup APIs, and restore APIs.
- Show a simple user-safe message: `This license is not valid for this device. Please activate again or contact support.`
- Log only structured reason codes, never full license keys, password hashes, JWTs, or raw machine identifiers.

## Authentication and Local Secrets

Keep the current password model, but move it to SQLite:

- Continue hashing passwords with `bcryptjs`.
- Keep roles limited to `admin`, `manager`, and `cashier`.
- Keep HTTP-only cookie sessions for the local Next/Electron runtime.
- Generate a per-install `JWT_SECRET` during first run and store it in the app data directory with user-only filesystem permissions.
- Do not use a fallback secret such as `your-secret-key-change-in-production`.
- Require the secret to be at least 32 random bytes, encoded as base64url or hex.

Current repo notes for implementation:

- `src/app/api/auth/login/route.ts` already rejects short/missing `JWT_SECRET`; preserve that behavior when moving from Supabase to SQLite.
- `src/app/api/users/route.ts` and `src/app/api/users/password/route.ts` currently fall back to a default JWT secret; remove that fallback in the offline conversion.
- Remove Supabase and Stripe runtime keys from the offline app's `.env.example` and packaged environment.

## Backup and Restore Risks

Backup/restore is necessary for an offline shop, but it can bypass controls if treated as a blind file copy.

Rules:

- Backups should include business data, users, settings, and product images.
- Backups may include the signed license only if the restore flow re-verifies the license against the current machine before enabling access.
- Never restore a backup over the active database while the app is serving requests.
- Validate backup file type, schema version, and manifest before import.
- Refuse path traversal entries when restoring image archives.
- Store backups outside the install directory and let the user choose destination.
- Do not include JWT session cookies, reset tokens, activation request nonces, raw entered license keys, or local runtime secrets in exported backups.
- If restoring to a new machine, require activation on that machine before opening protected POS screens.

Recommended backup manifest:

```json
{
  "app": "pos-system-offline",
  "schemaVersion": 1,
  "createdAt": "2026-07-26T00:00:00.000Z",
  "databaseSha256": "sha256:...",
  "includesImages": true,
  "includesLicense": false
}
```

## Tamper Handling

The app is a desktop app, so tampering cannot be made impossible. The goal is to make casual copying fail, avoid shipping secrets, and keep failure behavior predictable.

Tamper signals:

- Modified signed license payload.
- Signature mismatch.
- Machine mismatch.
- Local clock far before `issuedAt` or far after `expiresAt`.
- Missing local secret.
- Database schema downgrade.
- Restore manifest hash mismatch.

Response:

- Fail closed before login.
- Clear local sessions.
- Keep business data intact.
- Show activation/retry UI.
- Write a local security event with a reason code and timestamp.

Do not delete the database automatically on tamper detection.

## External Services Removed From Offline Runtime

The offline build must not call these during normal shop use:

- Supabase APIs or storage.
- Stripe Checkout or Stripe API routes.
- Vercel-hosted app routes.

The only permitted external call is the activation request before the device has a valid local license, plus an optional explicit support action such as `Check license status` if later implemented.

## Security Acceptance Checks

- Fresh install without a license shows activation before login.
- Valid activation works once online, then login and POS flows work offline.
- Copying the app data and database to another Windows device fails at license verification.
- Editing any byte of the signed license fails verification.
- Expired license blocks protected routes and APIs.
- Backup restore on the original device preserves data and re-verifies license.
- Backup restore on a new device requires activation before protected access.
- No packaged files contain `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, private license signing keys, raw license keys, or default JWT secrets.
- Logs do not contain passwords, password hashes, JWTs, full license keys, private keys, or raw machine identifiers.
