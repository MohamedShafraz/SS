# Security

This POS is being converted into an offline Windows desktop app. The security design for licensing, local secrets, backup/restore, and tamper behavior lives in:

- [docs/security/offline-license.md](docs/security/offline-license.md)

Security-sensitive implementation rules:

- Do not ship Supabase service keys, Stripe secrets, license private keys, or activation-admin credentials in the desktop app.
- Use signed license payloads verified with an embedded public key.
- Generate local runtime secrets per install; do not use fallback JWT secrets.
- Fail closed to activation UI when license verification fails.
- Keep business data intact on tamper detection so support can recover the client safely.
