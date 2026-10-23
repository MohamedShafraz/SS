# Local authentication

MSHPOS authenticates staff against the local SQLite `users` table. There are no bundled users, published passwords, Supabase sign-in, or cloud registration.

- A fresh database opens the first-run wizard. It atomically creates the business settings and first administrator only while there are zero users.
- Existing databases keep their users and password hashes during an upgrade.
- Login creates an HttpOnly, SameSite cookie. The server validates the signed session on protected pages and APIs; browser storage is not proof of authentication.
- Packaged Electron builds generate a cryptographically random per-install signing secret in the application user-data directory. Startup fails closed if it cannot be initialized.
- Development requires a unique `JWT_SECRET` of at least 32 characters in a local ignored environment file.

Roles are admin, manager, and cashier. Administrators manage users and maintenance; managers access their permitted operational areas; cashiers are limited to POS and permitted sale operations.
