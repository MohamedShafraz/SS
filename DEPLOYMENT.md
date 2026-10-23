# Windows deployment

MSHPOS is distributed as an Electron desktop application, not as a cloud-hosted web deployment.

- `dist:win` creates the backward-compatible NSIS build for unpackaged deployments.
- `dist:store` creates the Microsoft Store APPX and requires a public HTTPS `NEXT_PUBLIC_PRIVACY_POLICY_URL`.
- Store licensing validates only the paid base-app licence. There is no add-on purchase, subscription prompt, licence key, or activation server.

Do not bundle `.env` files, SQLite databases, customer data, private keys, certificates, test accounts, or default passwords. Follow [docs/store-release-checklist.md](docs/store-release-checklist.md) for the release gate.
