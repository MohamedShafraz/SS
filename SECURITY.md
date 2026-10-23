# Security

MSHPOS keeps operational data and staff authentication in local SQLite. The Store build uses the Microsoft Store base-app entitlement only; it has no Supabase credentials, Stripe secrets, licence keys, signing private keys, or custom activation service.

Security rules:

- Generate the session-signing secret per Electron installation and fail closed if it cannot be initialized.
- Require validated server sessions and role checks for protected pages and APIs.
- Validate loopback origin and mutation requests; validate privileged IPC sender URLs and payload sizes.
- Keep checkout, return, stock, setup, and restore workflows transactional.
- Stage and integrity-check backups before replacement, and create a recovery copy.
- Preserve existing user-data databases during upgrades and use additive migrations.
- Exclude environment files, databases, keys, certificates, test credentials, and customer data from packages.
- Never publish a default account or password.

Report security issues privately to mshpos@proton.me.
