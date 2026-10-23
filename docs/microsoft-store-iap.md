# Microsoft Store licence gate

MSHPOS is a one-time paid base application. A packaged Microsoft Store build calls `StoreContext.GetAppLicenseAsync()` before exposing the local POS server.

- An active base-app licence opens MSHPOS.
- An inactive licence directs the user to install or purchase the app through Microsoft Store.
- Store service errors offer Retry and Exit.
- There is no in-app purchase prompt, durable add-on, subscription, licence key, or custom activation backend.
- Only explicitly unpackaged development/NSIS execution bypasses Store entitlement. A packaged Store build fails closed.

The entitlement bridge requires Microsoft Store package identity. Validate active, inactive, offline-cached, refunded/expired, and Store-error states using Partner Center flight accounts. Do not judge entitlement behavior from an unpackaged Electron development run.
