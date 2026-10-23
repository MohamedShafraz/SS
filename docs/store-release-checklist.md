# Microsoft Store release checklist

- [ ] Version is greater than the latest Partner Center version (baseline source version is 0.1.1 / APPX 0.1.1.0).
- [ ] APPX identity and publisher exactly match Partner Center.
- [ ] `NEXT_PUBLIC_PRIVACY_POLICY_URL` is a reachable public HTTPS page matching the in-app policy.
- [ ] `mshpos@proton.me` is monitored.
- [ ] No environment file, database, customer data, key/certificate, secret, or test credential is packaged.
- [ ] Clean install starts with zero users and opens business/administrator setup.
- [ ] Upgrade preserves all local users, settings, inventory, transactions, barcode presets, and printer settings.
- [ ] Active/inactive/offline/error Store entitlement states pass in a private flight.
- [ ] Production build, TypeScript, lint, tests, dependency audit, and artifact scan pass.
- [ ] GA-2408T physical prints pass quantities 1, 2, 3, 4, and 6 and barcode text-size limits.
- [ ] Backup/restore and fault rollback tests pass.
- [ ] Windows App Certification Kit passes the exact upload artifact.
- [ ] The exact tested artifact is promoted from the private flight.
