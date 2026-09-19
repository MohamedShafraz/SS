using System.Text.Json;
using Windows.Services.Store;
using WinRT.Interop;

namespace StoreIapBridge;

internal static class Program
{
    [STAThread]
    private static async Task<int> Main(string[] args)
    {
        try
        {
            var options = BridgeOptions.Parse(args);
            if (string.IsNullOrWhiteSpace(options.ProductId))
            {
                return WriteJson(1, BridgeResult.Error("Missing --product-id."));
            }

            var context = StoreContext.GetDefault();

            // Desktop apps must attach Store UI to the owner HWND before calling
            // RequestPurchaseAsync. Electron passes the hidden main window handle.
            if (options.Hwnd != IntPtr.Zero)
            {
                InitializeWithWindow.Initialize(context, options.Hwnd);
            }

            var alreadyLicensed = await HasActiveLicenseAsync(context, options.ProductId);
            if (alreadyLicensed)
            {
                return WriteJson(0, BridgeResult.Active("Already purchased."));
            }

            if (!options.PurchaseIfNeeded)
            {
                return WriteJson(0, BridgeResult.Inactive("Not purchased."));
            }

            var purchase = await context.RequestPurchaseAsync(options.ProductId);
            if (purchase.Status is StorePurchaseStatus.Succeeded or StorePurchaseStatus.AlreadyPurchased)
            {
                var licensedAfterPurchase = await HasActiveLicenseAsync(context, options.ProductId);
                return WriteJson(
                    0,
                    licensedAfterPurchase
                        ? BridgeResult.Active("Purchase completed.")
                        : BridgeResult.Inactive("Purchase completed, but the license is not active yet.")
                );
            }

            return WriteJson(
                0,
                BridgeResult.Inactive(
                    $"Purchase status: {purchase.Status}. Extended error: {purchase.ExtendedError?.Message ?? "none"}"
                )
            );
        }
        catch (Exception error)
        {
            return WriteJson(1, BridgeResult.Error(error.Message));
        }
    }

    private static async Task<bool> HasActiveLicenseAsync(StoreContext context, string productId)
    {
        var license = await context.GetAppLicenseAsync();

        if (license.IsActive)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(productId))
        {
            return false;
        }

        // ProductId can point to the app's Store ID or a durable add-on/IAP.
        // Prefer the app license first, then fall back to add-on entitlement checks.
        return license.AddOnLicenses.TryGetValue(productId, out var addOnLicense)
            && addOnLicense.IsActive;
    }

    private static int WriteJson(int exitCode, BridgeResult result)
    {
        Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
        return exitCode;
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };
}

internal sealed record BridgeOptions(string ProductId, IntPtr Hwnd, bool PurchaseIfNeeded)
{
    public static BridgeOptions Parse(string[] args)
    {
        string productId = "";
        IntPtr hwnd = IntPtr.Zero;
        var purchaseIfNeeded = false;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--product-id" when i + 1 < args.Length:
                    productId = args[++i];
                    break;
                case "--hwnd" when i + 1 < args.Length:
                    hwnd = ulong.TryParse(args[++i], out var parsedHwnd)
                        ? new IntPtr(unchecked((long)parsedHwnd))
                        : IntPtr.Zero;
                    break;
                case "--purchase-if-needed":
                    purchaseIfNeeded = true;
                    break;
            }
        }

        return new BridgeOptions(productId, hwnd, purchaseIfNeeded);
    }
}

internal sealed record BridgeResult(bool Licensed, string Status, string Message)
{
    public static BridgeResult Active(string message) => new(true, "licensed", message);

    public static BridgeResult Inactive(string message) => new(false, "unlicensed", message);

    public static BridgeResult Error(string message) => new(false, "error", message);
}
