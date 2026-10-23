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
            var context = StoreContext.GetDefault();

            // Desktop apps attach StoreContext to the owner HWND before querying
            // the base-app licence. Electron passes the hidden main window handle.
            if (options.Hwnd != IntPtr.Zero)
            {
                InitializeWithWindow.Initialize(context, options.Hwnd);
            }

            var license = await context.GetAppLicenseAsync();
            return WriteJson(
                0,
                license.IsActive
                    ? BridgeResult.Active("Microsoft Store app license is active.")
                    : BridgeResult.Inactive("Microsoft Store app license is inactive.")
            );
        }
        catch (Exception error)
        {
            return WriteJson(1, BridgeResult.Error(error.Message));
        }
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

internal sealed record BridgeOptions(IntPtr Hwnd)
{
    public static BridgeOptions Parse(string[] args)
    {
        IntPtr hwnd = IntPtr.Zero;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--hwnd" when i + 1 < args.Length:
                    hwnd = ulong.TryParse(args[++i], out var parsedHwnd)
                        ? new IntPtr(unchecked((long)parsedHwnd))
                        : IntPtr.Zero;
                    break;
            }
        }

        return new BridgeOptions(hwnd);
    }
}

internal sealed record BridgeResult(bool Licensed, string Status, string Message)
{
    public static BridgeResult Active(string message) => new(true, "licensed", message);

    public static BridgeResult Inactive(string message) => new(false, "unlicensed", message);

    public static BridgeResult Error(string message) => new(false, "error", message);
}
