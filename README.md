# MSHPOS

MSHPOS is a Windows point-of-sale application built with Next.js, Electron, and a local SQLite database. Business data and staff authentication remain on the device; the Store build does not use Supabase, cloud synchronization, Stripe, or a custom activation service.

## Installation modes

- **Microsoft Store:** one-time paid app. Windows validates the base-app licence before the local POS server is exposed.
- **Unpackaged development / NSIS:** intended for development and existing non-Store deployments. It does not require Store package identity.

On a new installation, the setup wizard creates the business profile and first local administrator. It never publishes a default account. On upgrade, Electron reuses the database in its existing `userData` directory; schema migrations are additive and a pre-migration backup is created.

## Local development

Copy `.env.example` to a local, ignored environment file and replace the development JWT value with a random value of at least 32 characters. Packaged Electron builds generate their own secret in the protected user-data directory.

Common commands are listed in `package.json`. Before Store submission, follow [docs/store-release-checklist.md](docs/store-release-checklist.md) and [qa/offline-test-plan.md](qa/offline-test-plan.md).

## Printing

The GA-2408T preset means vertical roll feed while retaining the physical 102 × 25 mm page: three 31.33 × 25 mm stickers across with two 4 mm gaps. Copies fill left-to-right and continue on the next physical row. Existing saved orientation values remain readable but are ignored for this fixed preset; other layouts retain their orientation setting.

## Privacy and support

The in-app privacy policy describes local storage, backups, retention, deletion, and the Microsoft Store entitlement check. A public HTTPS copy is required for Store builds through `NEXT_PUBLIC_PRIVACY_POLICY_URL`.

Support: mshpos@proton.me
