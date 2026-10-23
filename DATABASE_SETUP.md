# Local database setup

MSHPOS uses SQLite in Electron's per-user application-data directory. No database file is bundled with the installer and no Supabase project is required.

On first launch SQLite creates an empty schema. The setup wizard then creates the business settings and first administrator in one transaction. On upgrades, the existing database is preserved, an upgrade backup is created, and migrations add compatible schema changes without deleting legacy columns or records.

Use the authenticated Backup and Restore screens for data movement. A restore is staged and checked with `PRAGMA quick_check` and required-table validation before it replaces the active database. Keep external copies of important backups, especially before uninstalling.
