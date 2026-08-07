# Microsoft Store IAP Gate

MSHPOS now gates startup in Electron before the POS interface loads:

1. Shows the mandatory License & Usage Agreement on first launch.
2. Saves acceptance in Electron `userData`.
3. Checks a durable Microsoft Store add-on license through `Windows.Services.Store.StoreContext`.
4. Opens the Microsoft Store purchase prompt if the add-on is not owned.
5. Quits the app if the user declines the agreement or does not complete the purchase.

## Product ID

Create a durable add-on/IAP in Partner Center and use its Store ID, not the display name.

Set it before writing the client config:

```powershell
$env:MICROSOFT_STORE_PRODUCT_ID="YOUR_PARTNER_CENTER_ADD_ON_STORE_ID"
npm.cmd run write-license-config
```

This writes:

```json
{
  "microsoftStoreProductId": "YOUR_PARTNER_CENTER_ADD_ON_STORE_ID"
}
```

You can also provide it at runtime with `MICROSOFT_STORE_PRODUCT_ID`.

## Store Packaging Notes

Microsoft Store IAP requires the app to run with Microsoft Store package identity. Test the full purchase flow from a Store-associated packaged build, not from plain local Electron dev mode.

The purchase prompt must be called on the UI thread and desktop apps must attach Store UI to an owner window handle. `native/StoreIapBridge` handles this by calling `InitializeWithWindow.Initialize(context, hwnd)` before `RequestPurchaseAsync`.

Microsoft also notes that Store IAP is not supported when the app is running elevated.
