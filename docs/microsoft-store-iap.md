# Microsoft Store IAP Gate

MSHPOS now gates startup in Electron before the POS interface loads:

1. Shows the mandatory License & Usage Agreement on first launch.
2. Saves acceptance in Electron `userData`.
3. Checks the Microsoft Store app license first, then falls back to a durable add-on entitlement if one is configured.
4. Opens the Microsoft Store purchase prompt if the configured Store product is not owned.
5. Quits the app if the user declines the agreement or does not complete the purchase.

There is no separate in-app license key or custom activation backend for Store builds. Microsoft handles payment and entitlement.

## Product ID

Create the Store product you want to gate on in Partner Center and use its Store ID, not the display name.

Set it before writing the client config:

```powershell
$env:MICROSOFT_STORE_PRODUCT_ID="YOUR_PARTNER_CENTER_STORE_ID"
npm.cmd run write-license-config
```

This writes:

```json
{
  "microsoftStoreProductId": "YOUR_PARTNER_CENTER_STORE_ID"
}
```

You can also provide it at runtime with `MICROSOFT_STORE_PRODUCT_ID`.

## Store Packaging Notes

Microsoft Store licensing requires the app to run with Microsoft Store package identity. Test the full purchase flow from a Store-associated packaged build, not from plain local Electron dev mode.

The purchase prompt must be called on the UI thread and desktop apps must attach Store UI to an owner window handle. `native/StoreIapBridge` handles this by calling `InitializeWithWindow.Initialize(context, hwnd)` before `RequestPurchaseAsync`.

Microsoft also notes that Store IAP is not supported when the app is running elevated.
