"use client";

import { MainLayout } from "@/components/layout";
import type {
  BarcodePdfViewerId,
  BarcodeStickerFieldAlignment,
  BarcodeStickerFieldId,
  BarcodeStickerPreset,
  BusinessProfile,
} from "@/types";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  Save,
  AlertCircle,
  Users,
  UserPlus,
  RotateCcw,
  ShieldCheck,
  Database,
  Download,
  FolderOpen,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { SHOP_TEMPLATES } from "@/lib/shop-offerings";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import {
  BARCODE_FIELD_DEFINITIONS,
  BUILT_IN_BARCODE_PRESETS,
  DEFAULT_BARCODE_FIELD_ORDER,
  getActiveBarcodePreset,
  getBarcodeFieldAlignment,
  getBarcodeFieldGapMm,
  getBarcodePresets,
  getVisibleBarcodeFields,
  isBarcodeFieldVisible,
  normalizeBarcodePreset,
} from "@/lib/barcode-layout";
import { getOfflineImageSrc } from "@/components/OfflineProductImage";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

interface MaintenanceReturn {
  id: string;
  original_transaction_id: string;
  reason?: string | null;
  status?: string | null;
  return_date: string;
}

type HardwareBridge = {
  selectBackupFolder?: () => Promise<{
    canceled?: boolean;
    path?: string;
    error?: string;
  }>;
  listPdfViewers?: () => Promise<Array<{
    id: BarcodePdfViewerId;
    name: string;
    installed: boolean;
  }>>;
  openPdfRepairSettings?: () => Promise<{ success: boolean; error?: string }>;
  previewBarcodeHtml?: (
    html: string,
    options: { pageWidthMm: number; pageHeightMm: number },
    viewerIds?: BarcodePdfViewerId[]
  ) => Promise<{ success: boolean; viewerName?: string; error?: string }>;
};

type PdfViewerInfo = {
  id: BarcodePdfViewerId;
  name: string;
  installed: boolean;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const canMaintain = user?.role === "admin" || user?.role === "manager";
  const canConfigureBarcodePrinting = user?.role === "admin";
  const [settings, setSettings] = useState<BusinessProfile>({
    businessName: "Unified Business",
    address: "123 Main Street, City",
    phone: "+94 77 712 3456",
    email: "info@business.com",
    taxRate: 5,
    currency: DEFAULT_CURRENCY,
    businessType: "Retail",
    barcodePrefix: "BCD",
    barcodeUsePrefix: true,
    barcodeDigitLength: 13,
    industryMode: "general",
    receiptLayout: "standard",
    receiptPaperWidth: "80mm",
    showReceiptBusinessInfo: true,
    logoImage: "",
    showReceiptFooter: true,
    receiptFooterMode: "return_days",
    receiptFooterDays: 7,
    receiptFooterText: "",
    // New installations default to the physical GA-2408T three-across roll.
    // A saved preset from an older installation overrides this after loading.
    barcodeStickerPresetId: "builtin-ga-2408t-102mm-3up-25mm",
    barcodeStickerCustomPresets: [],
    barcodePdfViewerEnabledIds: ["system", "adobe", "edge", "chrome", "firefox"],
    barcodePdfViewerPreferredId: "system",
    autoBackupEnabled: false,
    autoBackupFolderPath: "",
    autoBackupLastRunAt: "",
    autoBackupLastStatus: "",
    autoBackupLastMessage: "",
    autoBackupLastPath: "",
    allowTransactionDelete: false,
    posSetPriceRule: "least_price",
    billBarcodeEnabled: true,
    returnBarcodeEnabled: true,
    replacementBarcodeEnabled: true,
    replacementStockProtectionEnabled: true,
    partialReturnProtectionEnabled: true,
    taxCalculationEnabled: false,
    transactionFiltersEnabled: false,
    reportExportsEnabled: false,
    backupRestoreAdminOnlyEnabled: true,
    shopBillingEnabled: false,
    shopDashboardReceivablesEnabled: true,
    shopDashboardPartialBillsEnabled: true,
    shopDashboardUnpaidBillsEnabled: true,
    shopDashboardFollowupPaymentsEnabled: true,
    shopDashboardFollowupTableEnabled: true,
  });

  const [barcodeScannerSettings, setBarcodeScannerSettings] = useState({
    enabled: true,
    soundAlert: true,
    autoFocus: true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    lowStockAlert: true,
    lowStockThreshold: 10,
    dailyReport: false,
  });

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [maintenanceReturns, setMaintenanceReturns] = useState<MaintenanceReturn[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier",
  });
  const [resetForm, setResetForm] = useState({
    email: "",
    password: "",
  });
  const [backupWorking, setBackupWorking] = useState<
    "download" | "restore" | "folder" | "auto" | null
  >(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [savedCredential, setSavedCredential] = useState<{
    email: string;
    password: string;
    note: string;
  } | null>(null);
  const [showTransactionDeleteWarning, setShowTransactionDeleteWarning] = useState(false);
  const [pdfViewers, setPdfViewers] = useState<PdfViewerInfo[]>([
    { id: "system", name: "Windows default PDF app", installed: true },
    { id: "adobe", name: "Adobe Acrobat / Reader", installed: false },
    { id: "edge", name: "Microsoft Edge", installed: false },
    { id: "chrome", name: "Google Chrome", installed: false },
    { id: "firefox", name: "Mozilla Firefox", installed: false },
  ]);
  const [barcodeAppPreviewSupported, setBarcodeAppPreviewSupported] = useState(false);
  const [openingBarcodeSample, setOpeningBarcodeSample] = useState(false);

  const handleSettingChange = (
    key: keyof BusinessProfile,
    value: BusinessProfile[keyof BusinessProfile]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const activeBarcodePreset = getActiveBarcodePreset(settings);
  const barcodePresets = getBarcodePresets(settings);
  const logoPreviewImage = getOfflineImageSrc(settings.logoImage);
  const isGa2408tPreset =
    activeBarcodePreset.id === "builtin-ga-2408t-102mm-3up-25mm" ||
    (
      activeBarcodePreset.columns === 3 &&
      activeBarcodePreset.rows === 1 &&
      Math.abs(Number(activeBarcodePreset.stickerHeightMm) - 25) <= 0.5 &&
      Math.abs(Number(activeBarcodePreset.columnGapMm) - 4) <= 0.5 &&
      Math.abs(Number(activeBarcodePreset.marginLeftMm)) <= 0.5 &&
      Math.abs(Number(activeBarcodePreset.marginRightMm)) <= 0.5
    );

  const updateActiveBarcodePreset = (updates: Partial<BarcodeStickerPreset>) => {
    const current = normalizeBarcodePreset({ ...activeBarcodePreset, ...updates });
    if (current.builtIn) {
      const custom = {
        ...current,
        id: `custom-${Date.now()}`,
        name: `${current.name} Custom`,
        builtIn: false,
      };
      setSettings((prev) => ({
        ...prev,
        barcodeStickerPresetId: custom.id,
        barcodeStickerCustomPresets: [...(prev.barcodeStickerCustomPresets || []), custom],
      }));
      return;
    }

    setSettings((prev) => ({
      ...prev,
      barcodeStickerCustomPresets: (prev.barcodeStickerCustomPresets || []).map((preset) =>
        preset.id === current.id ? current : preset
      ),
    }));
  };

  const createCustomBarcodePreset = () => {
    const custom = {
      ...activeBarcodePreset,
      id: `custom-${Date.now()}`,
      name: `${activeBarcodePreset.name} Copy`,
      builtIn: false,
    };
    setSettings((prev) => ({
      ...prev,
      barcodeStickerPresetId: custom.id,
      barcodeStickerCustomPresets: [...(prev.barcodeStickerCustomPresets || []), custom],
    }));
  };

  const deleteActiveBarcodePreset = () => {
    if (activeBarcodePreset.builtIn) return;
    setSettings((prev) => ({
      ...prev,
      barcodeStickerPresetId: BUILT_IN_BARCODE_PRESETS[0].id,
      barcodeStickerCustomPresets: (prev.barcodeStickerCustomPresets || []).filter(
        (preset) => preset.id !== activeBarcodePreset.id
      ),
    }));
  };

  const moveBarcodeField = (field: BarcodeStickerFieldId, direction: -1 | 1) => {
    const order = [...(activeBarcodePreset.fieldOrder || DEFAULT_BARCODE_FIELD_ORDER)];
    const currentIndex = order.indexOf(field);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return;

    [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
    updateActiveBarcodePreset({ fieldOrder: order });
  };

  const updateBarcodeFieldGap = (field: BarcodeStickerFieldId, gapMm: number) => {
    updateActiveBarcodePreset({
      fieldGapsMm: {
        ...(activeBarcodePreset.fieldGapsMm || {}),
        [field]: Math.max(0, gapMm),
      },
    });
  };

  const updateBarcodeFieldAlignment = (
    field: BarcodeStickerFieldId,
    alignment: BarcodeStickerFieldAlignment
  ) => {
    updateActiveBarcodePreset({
      fieldAlignments: {
        ...(activeBarcodePreset.fieldAlignments || {}),
        [field]: alignment,
      },
    });
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      handleSettingChange("logoImage", String(loadEvent.target?.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const handleBarcodeScannerChange = (key: string, value: boolean) => {
    setBarcodeScannerSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleNotificationChange = (key: string, value: boolean | number) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: value }));
  };

  const renderFeatureToggle = (
    key: keyof BusinessProfile,
    title: string,
    description: string,
    defaultEnabled = false
  ) => (
    <label className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4">
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={defaultEnabled ? settings[key] !== false : Boolean(settings[key])}
        onChange={(e) => handleSettingChange(key, e.target.checked as BusinessProfile[keyof BusinessProfile])}
        className="h-6 w-6 cursor-pointer"
      />
    </label>
  );

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      setUsersLoading(true);
      const response = await fetch("/api/users", { signal });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to load users");
      }

      setUsers(result.users || []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      if (!signal?.aborted) {
        setUsersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchUsers(controller.signal);

    return () => controller.abort();
  }, [fetchUsers]);

  const fetchMaintenanceRecords = useCallback(async () => {
    if (!canMaintain) return;
    try {
      const response = await fetch("/api/admin/maintenance");
      if (!response.ok) return;
      const result = await response.json();
      setMaintenanceReturns((result.returns || []) as MaintenanceReturn[]);
    } catch {
      // Maintenance data is optional for older installations.
    }
  }, [canMaintain]);

  useEffect(() => {
    fetchMaintenanceRecords();
  }, [fetchMaintenanceRecords]);

  useEffect(() => {
    let active = true;

    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result.settings) return;
        setSettings((prev) => ({ ...prev, ...result.settings }));
        localStorage.setItem("posSettings", JSON.stringify(result.settings));
      })
      .catch(() => {
        const stored = localStorage.getItem("posSettings");
        if (!stored) return;
        try {
          setSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
        } catch {
          // Keep defaults if local settings are invalid.
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canConfigureBarcodePrinting) return;
    const bridge = (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;
    setBarcodeAppPreviewSupported(Boolean(bridge?.previewBarcodeHtml));
    bridge?.listPdfViewers?.()
      .then((viewers) => {
        if (viewers.length > 0) setPdfViewers(viewers);
      })
      .catch((error) => console.warn("Unable to detect PDF viewers:", error));
  }, [canConfigureBarcodePrinting]);

  const getEnabledPdfViewerIds = () => {
    const supported: BarcodePdfViewerId[] = ["system", "adobe", "edge", "chrome", "firefox"];
    const configured = settings.barcodePdfViewerEnabledIds?.filter((id) => supported.includes(id));
    return configured && configured.length > 0 ? configured : supported;
  };

  const togglePdfViewer = (viewerId: BarcodePdfViewerId, enabled: boolean) => {
    const current = getEnabledPdfViewerIds();
    const next = enabled
      ? [...current, viewerId].filter((id, index, ids) => ids.indexOf(id) === index)
      : current.filter((id) => id !== viewerId);
    if (next.length === 0) {
      toast.error("At least one PDF preview app must remain enabled");
      return;
    }
    setSettings((previous) => ({
      ...previous,
      barcodePdfViewerEnabledIds: next,
      barcodePdfViewerPreferredId: next.includes(previous.barcodePdfViewerPreferredId || "system")
        ? previous.barcodePdfViewerPreferredId
        : next[0],
    }));
  };

  const openPdfRepairSettings = async () => {
    const bridge = (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;
    if (!bridge?.openPdfRepairSettings) {
      toast.error("Windows repair settings are available in the desktop app");
      return;
    }
    const result = await bridge.openPdfRepairSettings();
    if (!result.success) toast.error(result.error || "Unable to open Windows settings");
  };

  const getBarcodeSamplePageSize = () => {
    if (isGa2408tPreset) {
      return { width: 102, height: 25 };
    }

    return {
      width:
        activeBarcodePreset.stickerWidthMm * activeBarcodePreset.columns +
        activeBarcodePreset.columnGapMm * Math.max(0, activeBarcodePreset.columns - 1) +
        activeBarcodePreset.marginLeftMm +
        activeBarcodePreset.marginRightMm,
      height: Math.min(
        activeBarcodePreset.maxRollLengthMm,
        activeBarcodePreset.stickerHeightMm * activeBarcodePreset.rows +
          activeBarcodePreset.rowGapMm * Math.max(0, activeBarcodePreset.rows - 1) +
          activeBarcodePreset.marginTopMm +
          activeBarcodePreset.marginBottomMm
      ),
    };
  };

  const buildBarcodeSampleHtml = () => {
    const page = getBarcodeSamplePageSize();
    const escapeSampleText = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const labelWidth = isGa2408tPreset ? 31.33 : activeBarcodePreset.stickerWidthMm;
    const labelHeight = isGa2408tPreset ? 25 : activeBarcodePreset.stickerHeightMm;
    const columns = isGa2408tPreset ? 3 : activeBarcodePreset.columns;
    const rows = isGa2408tPreset ? 1 : activeBarcodePreset.rows;
    const columnGap = isGa2408tPreset ? 4 : activeBarcodePreset.columnGapMm;
    const rowGap = isGa2408tPreset ? 0 : activeBarcodePreset.rowGapMm;
    const sampleField = (field: BarcodeStickerFieldId) => {
      const alignment = getBarcodeFieldAlignment(activeBarcodePreset, field);
      const gap = getBarcodeFieldGapMm(activeBarcodePreset, field);
      const style = `text-align:${alignment};margin-bottom:${gap}mm;`;
      if (field === "barcodeImage") return `<div class="barcode" style="${style}"></div>`;
      const values: Record<Exclude<BarcodeStickerFieldId, "barcodeImage">, string> = {
        businessName: escapeSampleText(settings.businessName || "Sample Business"),
        businessAddress: escapeSampleText(settings.address || "123 Main Street"),
        businessPhone: escapeSampleText(settings.phone || "+94 77 712 3456"),
        productName: "Sample Product",
        barcodeText: "BCD-1789800117556",
        sellingPrice: `Price: ${escapeSampleText(formatCurrency(1800, settings.currency))}`,
        leastPrice: `Least: ${escapeSampleText(formatCurrency(1650, settings.currency))}`,
        leastPriceCode: "BM6",
      };
      const classes: Record<Exclude<BarcodeStickerFieldId, "barcodeImage">, string> = {
        businessName: "business", businessAddress: "business address", businessPhone: "business phone",
        productName: "product", barcodeText: "barcode-text", sellingPrice: "price",
        leastPrice: "least", leastPriceCode: "code",
      };
      return `<div class="${classes[field]}" style="${style}">${values[field]}</div>`;
    };
    const sampleLabel = `<div class="label">${getVisibleBarcodeFields(activeBarcodePreset).map(sampleField).join("")}</div>`;
    const labelCount = Math.max(1, Math.min(12, columns * rows));

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: ${page.width}mm ${page.height}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: ${page.width}mm; min-height: ${page.height}mm; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; }
      .sheet { width: ${page.width}mm; min-height: ${page.height}mm; display: grid;
        grid-template-columns: repeat(${columns}, ${labelWidth}mm); grid-auto-rows: ${labelHeight}mm;
        gap: ${rowGap}mm ${columnGap}mm; padding: ${isGa2408tPreset ? 0 : activeBarcodePreset.marginTopMm}mm ${isGa2408tPreset ? 0 : activeBarcodePreset.marginRightMm}mm ${isGa2408tPreset ? 0 : activeBarcodePreset.marginBottomMm}mm ${isGa2408tPreset ? 0 : activeBarcodePreset.marginLeftMm}mm; }
      .label { width: ${labelWidth}mm; height: ${labelHeight}mm; overflow: hidden; padding: .7mm .4mm;
        display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; line-height: 1; }
      .business { width: 100%; overflow: hidden; font-size: ${activeBarcodePreset.businessInfoFontSize}px; font-weight: 700; white-space: nowrap; }
      .address { font-size: ${activeBarcodePreset.businessAddressFontSize || Math.max(5, activeBarcodePreset.businessInfoFontSize - 1)}px; font-weight: 400; }
      .phone { font-size: ${activeBarcodePreset.businessPhoneFontSize || Math.max(5, activeBarcodePreset.businessInfoFontSize - 1)}px; font-weight: 400; }
      .product { width: 100%; overflow: hidden; margin-top: .5mm; font-size: ${activeBarcodePreset.productNameFontSize}px; font-weight: 700; white-space: nowrap; }
      .barcode { width: 92%; height: ${Math.min(10, activeBarcodePreset.barcodeHeightMm)}mm; margin-top: .7mm;
        background: repeating-linear-gradient(90deg, #111 0, #111 .35mm, transparent .35mm, transparent .65mm, #111 .65mm, #111 .85mm, transparent .85mm, transparent 1.25mm); }
      .barcode-text { margin-top: .25mm; font-size: ${activeBarcodePreset.barcodeTextFontSize || Math.max(6, activeBarcodePreset.businessInfoFontSize)}px; white-space: nowrap; }
      .price { margin-top: .45mm; font-size: ${activeBarcodePreset.sellingPriceFontSize}px; font-weight: 800; }
      .least { font-size: ${activeBarcodePreset.leastPriceFontSize}px; }
      .code { font-size: ${activeBarcodePreset.leastPriceCodeFontSize}px; font-weight: 700; }
    </style></head><body><div class="sheet">${Array.from({ length: labelCount }, () => sampleLabel).join("")}</div></body></html>`;
  };

  const openBarcodeSample = async () => {
    const bridge = (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;
    if (!bridge?.previewBarcodeHtml) {
      toast.error("Barcode sample preview requires the latest MSHPOS desktop app");
      return;
    }

    setOpeningBarcodeSample(true);
    try {
      const page = getBarcodeSamplePageSize();
      const result = await bridge.previewBarcodeHtml(
        buildBarcodeSampleHtml(),
        { pageWidthMm: page.width, pageHeightMm: page.height },
        getEnabledPdfViewerIds()
      );
      if (!result.success) throw new Error(result.error || "Unable to open barcode sample");
      toast.success(`Sample opened in ${result.viewerName || "the configured PDF app"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open barcode sample");
    } finally {
      setOpeningBarcodeSample(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.password.trim()) {
      toast.error("Email and password are required");
      return;
    }

    try {
      setSavingUser(true);
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create user");
      }

      setSavedCredential({
        email: newUser.email,
        password: newUser.password,
        note: "Save these credentials now. The password is hashed in the database and cannot be recovered later.",
      });
      setNewUser({ name: "", email: "", password: "", role: "cashier" });
      toast.success("User saved to database");
      await fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetForm.email.trim() || !resetForm.password.trim()) {
      toast.error("Email and new password are required");
      return;
    }

    try {
      setResettingPassword(true);
      const response = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to reset password");
      }

      setSavedCredential({
        email: resetForm.email,
        password: resetForm.password,
        note: "Password reset saved. Share the new password with the user securely.",
      });
      setResetForm({ email: "", password: "" });
      toast.success("Password updated in database");
      await fetchUsers();
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const saveSettingsToStore = async (nextSettings: BusinessProfile) => {
    localStorage.setItem("posSettings", JSON.stringify(nextSettings));
    localStorage.setItem(
      "barcodeScannerSettings",
      JSON.stringify(barcodeScannerSettings)
    );
    localStorage.setItem(
      "notificationSettings",
      JSON.stringify(notificationSettings)
    );

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to save settings");
      if (result.settings) {
        const savedSettings = { ...nextSettings, ...result.settings };
        setSettings(savedSettings);
        localStorage.setItem("posSettings", JSON.stringify(savedSettings));
        return savedSettings;
      }
      return nextSettings;
    } catch (error) {
      throw error instanceof Error ? error : new Error("Settings saved locally only");
    }
  };

  const updateManagedUser = async (managedUser: ManagedUser) => {
    const role = window.prompt("Role (admin, manager, cashier)", managedUser.role)?.trim();
    if (!role || !["admin", "manager", "cashier"].includes(role)) return;
    const active = window.confirm("Keep this user active? Choose Cancel to deactivate.");
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: managedUser.id, role, active }),
    });
    const result = await response.json();
    if (!response.ok) toast.error(result.message || "Failed to update user");
    else { toast.success("User updated"); fetchUsers(); }
  };

  const deleteManagedUser = async (managedUser: ManagedUser) => {
    if (!window.confirm(`Delete ${managedUser.email}? This cannot be undone.`)) return;
    const response = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: managedUser.id }),
    });
    const result = await response.json();
    if (!response.ok) toast.error(result.message || "Failed to delete user");
    else { toast.success("User deleted"); fetchUsers(); }
  };

  const updateReturnStatus = async (record: MaintenanceReturn) => {
    const status = window.prompt("Status (pending, completed, cancelled)", record.status || "pending")?.trim();
    if (!status || !["pending", "completed", "cancelled"].includes(status)) return;
    const response = await fetch("/api/admin/maintenance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "returns", id: record.id, values: { status } }),
    });
    const result = await response.json();
    if (!response.ok) toast.error(result.error?.message || "Failed to update return");
    else { toast.success("Return updated"); fetchMaintenanceRecords(); }
  };

  const deleteReturn = async (record: MaintenanceReturn) => {
    if (!window.confirm("Delete this return and its return items?")) return;
    const response = await fetch("/api/admin/maintenance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "returns", id: record.id }),
    });
    const result = await response.json();
    if (!response.ok) toast.error(result.error?.message || "Failed to delete return");
    else { toast.success("Return deleted"); fetchMaintenanceRecords(); }
  };

  const handleSave = async () => {
    try {
      await saveSettingsToStore(settings);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings saved locally only");
    }
  };

  const handleTransactionDeleteToggle = (enabled: boolean) => {
    if (!enabled) {
      handleSettingChange("allowTransactionDelete", false);
      return;
    }

    setShowTransactionDeleteWarning(true);
  };

  const confirmTransactionDeleteSetting = () => {
    handleSettingChange("allowTransactionDelete", true);
    setShowTransactionDeleteWarning(false);
  };

  const getBackupFilename = (disposition: string | null) => {
    const fallback = `pos-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    if (!disposition) return fallback;

    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return match?.[1] || fallback;
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupWorking("download");
      const response = await fetch("/api/backup", { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || "Failed to create backup");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getBackupFilename(response.headers.get("content-disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download backup");
    } finally {
      setBackupWorking(null);
    }
  };

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (settings.backupRestoreAdminOnlyEnabled !== false && user?.role !== "admin") {
      toast.error("Only admins can restore backups");
      return;
    }

    if (!window.confirm("Restore this backup and replace the current local data?")) {
      return;
    }

    try {
      setBackupWorking("restore");
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || "Failed to restore backup");
      }

      localStorage.removeItem("posSettings");
      toast.success(result?.message || "Backup restored");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore backup");
    } finally {
      setBackupWorking(null);
    }
  };

  const handleChooseBackupFolder = async () => {
    const bridge = (window as Window & { mshposHardware?: HardwareBridge }).mshposHardware;
    if (!bridge?.selectBackupFolder) {
      toast.error("Backup folder picker is available in the desktop app");
      return;
    }

    try {
      setBackupWorking("folder");
      const result = await bridge.selectBackupFolder();
      if (result.canceled) return;
      if (!result.path) throw new Error(result.error || "No backup folder selected");

      const nextSettings = {
        ...settings,
        autoBackupFolderPath: result.path,
      };
      setSettings(nextSettings);
      await saveSettingsToStore(nextSettings);
      toast.success("Backup folder saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to choose backup folder");
    } finally {
      setBackupWorking(null);
    }
  };

  const handleRunAutoBackup = async () => {
    if (!settings.autoBackupFolderPath?.trim()) {
      toast.error("Choose a backup folder first");
      return;
    }

    try {
      setBackupWorking("auto");
      await saveSettingsToStore(settings);
      const response = await fetch("/api/backup/auto", {
        method: "POST",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (result?.settings) {
        setSettings((prev) => ({ ...prev, ...result.settings }));
        localStorage.setItem("posSettings", JSON.stringify(result.settings));
      }
      if (!response.ok) {
        throw new Error(result?.message || "Automatic backup failed");
      }

      toast.success(result?.message || "Automatic backup checked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Automatic backup failed");
    } finally {
      setBackupWorking(null);
    }
  };

  const renderPreviewBarcodeField = (field: BarcodeStickerFieldId) => {
    const gapPx = Math.max(0, getBarcodeFieldGapMm(activeBarcodePreset, field) * 2);
    const alignment = getBarcodeFieldAlignment(activeBarcodePreset, field);
    const textStyle = {
      marginBottom: `${gapPx}px`,
      textAlign: alignment,
    } satisfies CSSProperties;

    if (field === "businessName") {
      return (
        <div key={field} className="w-full truncate font-bold" style={{ ...textStyle, fontSize: activeBarcodePreset.businessInfoFontSize }}>
          GOODE
        </div>
      );
    }

    if (field === "businessAddress") {
      return (
        <div key={field} className="w-full truncate" style={{ ...textStyle, fontSize: activeBarcodePreset.businessAddressFontSize || Math.max(5, activeBarcodePreset.businessInfoFontSize - 1) }}>
          123 Main Street
        </div>
      );
    }

    if (field === "businessPhone") {
      return (
        <div key={field} className="w-full truncate" style={{ ...textStyle, fontSize: activeBarcodePreset.businessPhoneFontSize || Math.max(5, activeBarcodePreset.businessInfoFontSize - 1) }}>
          +94 77 712 3456
        </div>
      );
    }

    if (field === "productName") {
      return (
        <div key={field} className="w-full font-semibold truncate" style={{ ...textStyle, fontSize: activeBarcodePreset.productNameFontSize }}>
          Sample Product
        </div>
      );
    }

    if (field === "barcodeImage") {
      const justifyContent =
        alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
      return (
        <div key={field} className="w-full flex" style={{ marginBottom: `${gapPx}px`, justifyContent }}>
          <div
            className="bg-gray-900"
            style={{
              width: isGa2408tPreset ? "88px" : "96px",
              height: isGa2408tPreset && (activeBarcodePreset.showBusinessAddress || activeBarcodePreset.showBusinessPhone) ? "20px" : isGa2408tPreset ? "28px" : "24px",
            }}
          />
        </div>
      );
    }

    if (field === "barcodeText") {
      return (
        <div
          key={field}
          className="w-full truncate"
          style={{
            ...textStyle,
            fontSize: activeBarcodePreset.barcodeTextFontSize || Math.max(6, activeBarcodePreset.businessInfoFontSize),
          }}
        >
          BCD-1789800117556
        </div>
      );
    }

    if (field === "sellingPrice") {
      return (
        <div key={field} className="w-full truncate font-bold" style={{ ...textStyle, fontSize: activeBarcodePreset.sellingPriceFontSize }}>
          Price: 1,800
        </div>
      );
    }

    if (field === "leastPrice") {
      return (
        <div key={field} className="w-full truncate" style={{ ...textStyle, fontSize: activeBarcodePreset.leastPriceFontSize }}>
          Least: 1,650
        </div>
      );
    }

    return (
      <div key={field} className="w-full truncate font-bold" style={{ ...textStyle, fontSize: activeBarcodePreset.leastPriceCodeFontSize }}>
        BM6
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your POS system</p>
        </div>

        {/* Shop Information */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Business Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Business Name
              </label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) =>
                  handleSettingChange("businessName", e.target.value)
                }
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Address
              </label>
              <textarea
                value={settings.address}
                onChange={(e) =>
                  handleSettingChange("address", e.target.value)
                }
                className="input-base resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) =>
                    handleSettingChange("phone", e.target.value)
                  }
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) =>
                    handleSettingChange("email", e.target.value)
                  }
                  className="input-base"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Business Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Business Settings
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Industry Mode
                </label>
                <select
                  value={settings.industryMode}
                  onChange={(e) =>
                    handleSettingChange("industryMode", e.target.value)
                  }
                  className="input-base"
                >
                  {SHOP_TEMPLATES.map((template) => (
                    <option key={template.mode} value={template.mode}>
                      {template.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  Choose the shop type that matches your products and categories.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Business Type
                </label>
                <select
                  value={settings.businessType}
                  onChange={(e) =>
                    handleSettingChange("businessType", e.target.value)
                  }
                  className="input-base"
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Currency
                </label>
                <select
                  value={CURRENCY_OPTIONS.some((item) => item.code === settings.currency) ? settings.currency : "custom"}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleSettingChange("currency", value === "custom" ? settings.currency || DEFAULT_CURRENCY : value);
                  }}
                  className="input-base"
                >
                  {CURRENCY_OPTIONS.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.label}
                    </option>
                  ))}
                  <option value="custom">Custom symbol</option>
                </select>
                {!CURRENCY_OPTIONS.some((item) => item.code === settings.currency) && (
                  <input
                    type="text"
                    value={settings.currency}
                    onChange={(e) =>
                      handleSettingChange("currency", e.target.value)
                    }
                    className="input-base mt-2"
                    placeholder="Currency symbol or code"
                  />
                )}
                <p className="text-xs text-gray-600 mt-1">
                  Preview: {formatCurrency(1250, settings.currency)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) =>
                    handleSettingChange("taxRate", parseFloat(e.target.value))
                  }
                  className="input-base"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Barcode Prefix
                </label>
                <input
                  type="text"
                  value={settings.barcodePrefix}
                  onChange={(e) =>
                    handleSettingChange("barcodePrefix", e.target.value)
                  }
                  className="input-base"
                  maxLength={10}
                />
              </div>

              <label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm font-medium text-gray-900">
                <input
                  type="checkbox"
                  checked={settings.barcodeUsePrefix !== false}
                  onChange={(e) =>
                    handleSettingChange("barcodeUsePrefix", e.target.checked)
                  }
                  className="w-5 h-5"
                />
                Use prefix and dash on generated barcodes
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Generated Barcode Digits
                </label>
                <input
                  type="number"
                  value={settings.barcodeDigitLength || 13}
                  onChange={(e) =>
                    handleSettingChange(
                      "barcodeDigitLength",
                      Math.max(1, Math.min(18, Number(e.target.value) || 13))
                    )
                  }
                  className="input-base"
                  min="1"
                  max="18"
                  step="1"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Use 5 or 6 for small numeric-only stickers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Transaction Controls
            </h2>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4">
            <div>
              <p className="font-medium text-gray-900">Allow transaction deletion</p>
              <p className="text-sm text-gray-600">
                Enables admin-only deletion for mistaken transactions.
              </p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.allowTransactionDelete)}
              onChange={(e) => handleTransactionDeleteToggle(e.target.checked)}
              className="h-6 w-6 cursor-pointer"
            />
          </label>

          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <div className="mb-3">
              <p className="font-medium text-gray-900">POS set price limit</p>
              <p className="text-sm text-gray-600">
                Controls the lowest set price allowed for items in the POS cart.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  value: "least_price",
                  label: "Greater than or equal to least price",
                },
                {
                  value: "cost",
                  label: "Greater than or equal to cost",
                },
                {
                  value: "below_cost",
                  label: "Allow less than cost",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-gray-900"
                >
                  <input
                    type="radio"
                    name="posSetPriceRule"
                    value={option.value}
                    checked={(settings.posSetPriceRule || "least_price") === option.value}
                    onChange={() =>
                      handleSettingChange(
                        "posSetPriceRule",
                        option.value as BusinessProfile["posSetPriceRule"]
                      )
                    }
                    className="h-5 w-5 cursor-pointer"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Options */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Feature Options</h2>
            <p className="text-sm text-gray-600">
              Optional POS features are backward compatible. Missing values in older settings keep safe defaults.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">Barcode Workflows</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {renderFeatureToggle(
                  "billBarcodeEnabled",
                  "Bill barcode scanning",
                  "Allow scanner input in normal sale mode.",
                  true
                )}
                {renderFeatureToggle(
                  "returnBarcodeEnabled",
                  "Return barcode lookup",
                  "Allow transaction ID scan or Enter lookup in return mode.",
                  true
                )}
                {renderFeatureToggle(
                  "replacementBarcodeEnabled",
                  "Replacement barcode scan",
                  "Allow product and variant scan-to-add in replacement mode.",
                  true
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-gray-900">POS Safety</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {renderFeatureToggle(
                  "replacementStockProtectionEnabled",
                  "Replacement stock protection",
                  "Block replacement quantities that exceed available stock.",
                  true
                )}
                {renderFeatureToggle(
                  "partialReturnProtectionEnabled",
                  "Partial return protection",
                  "Prevent already-returned quantities from being returned again.",
                  true
                )}
                {renderFeatureToggle(
                  "taxCalculationEnabled",
                  "Tax calculation",
                  "Apply the configured tax rate during checkout and on receipts."
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-gray-900">Reports And Data</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {renderFeatureToggle(
                  "transactionFiltersEnabled",
                  "Transaction filters",
                  "Filter transactions by date, payment method, and transaction type."
                )}
                {renderFeatureToggle(
                  "reportExportsEnabled",
                  "Report exports",
                  "Export the current transaction list to CSV."
                )}
                {renderFeatureToggle(
                  "backupRestoreAdminOnlyEnabled",
                  "Admin-only backup restore",
                  "Require an admin login before restoring backup data.",
                  true
                )}
                {renderFeatureToggle(
                  "shopBillingEnabled",
                  "Neighbour shop billing",
                  "Allow POS bills for shop accounts with unpaid and partial payment tracking."
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-gray-900">Shop Dashboard</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {renderFeatureToggle(
                  "shopDashboardReceivablesEnabled",
                  "Shop receivables card",
                  "Show total outstanding neighbour shop dues on the dashboard.",
                  true
                )}
                {renderFeatureToggle(
                  "shopDashboardPartialBillsEnabled",
                  "Partial bills card",
                  "Show the count of partially paid shop bills.",
                  true
                )}
                {renderFeatureToggle(
                  "shopDashboardUnpaidBillsEnabled",
                  "Unpaid bills card",
                  "Show the count of unpaid shop bills.",
                  true
                )}
                {renderFeatureToggle(
                  "shopDashboardFollowupPaymentsEnabled",
                  "Follow-up payments card",
                  "Show today's follow-up payments collected from old shop bills.",
                  true
                )}
                {renderFeatureToggle(
                  "shopDashboardFollowupTableEnabled",
                  "Follow-up bills table",
                  "Show unpaid and partial shop bills that need collection follow-up.",
                  true
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Print Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Print Layout
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Receipt Layout
              </label>
              <select
                value={settings.receiptLayout || "standard"}
                onChange={(e) =>
                  handleSettingChange("receiptLayout", e.target.value)
                }
                className="input-base"
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Paper Width
              </label>
              <select
                value={settings.receiptPaperWidth || "80mm"}
                onChange={(e) =>
                  handleSettingChange("receiptPaperWidth", e.target.value)
                }
                className="input-base"
              >
                <option value="58mm">58mm</option>
                <option value="80mm">80mm</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Business Header</h3>
              <p className="text-sm text-gray-600">
                Show shop name, address, phone, and email on the bill
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showReceiptBusinessInfo !== false}
              onChange={(e) =>
                handleSettingChange("showReceiptBusinessInfo", e.target.checked)
              }
              className="w-6 h-6 cursor-pointer"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Receipt Logo</h3>
              <input type="file" accept="image/*" onChange={handleLogoChange} className="input-base" />
              {logoPreviewImage && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={logoPreviewImage} alt="Receipt logo" className="h-16 w-16 object-contain border rounded bg-white" />
                  <button
                    type="button"
                    onClick={() => handleSettingChange("logoImage", "")}
                    className="btn-secondary btn-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-gray-900">Receipt Footer</h3>
                  <p className="text-sm text-gray-600">Return or bill validity message</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showReceiptFooter !== false}
                  onChange={(e) => handleSettingChange("showReceiptFooter", e.target.checked)}
                  className="w-6 h-6 cursor-pointer"
                />
              </div>
              <select
                value={settings.receiptFooterMode || "return_days"}
                onChange={(e) => handleSettingChange("receiptFooterMode", e.target.value)}
                className="input-base"
              >
                <option value="return_days">Return allowed within X days</option>
                <option value="valid_days">Bill valid for X days</option>
                <option value="custom">Custom footer</option>
              </select>
              {(settings.receiptFooterMode || "return_days") === "custom" ? (
                <input
                  type="text"
                  value={settings.receiptFooterText || ""}
                  onChange={(e) => handleSettingChange("receiptFooterText", e.target.value)}
                  className="input-base"
                  placeholder="Footer text"
                />
              ) : (
                <input
                  type="number"
                  min={1}
                  value={settings.receiptFooterDays || 7}
                  onChange={(e) => handleSettingChange("receiptFooterDays", Math.max(1, Number(e.target.value) || 1))}
                  className="input-base"
                />
              )}
            </div>
          </div>
        </div>

        {/* Barcode Sticker Layout */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Barcode Sticker Layout</h2>
              <p className="text-sm text-gray-600">Configure sticker size, grid, printer roll length, and visible label fields.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={createCustomBarcodePreset} className="btn-primary btn-sm">
                Save Custom
              </button>
              <button type="button" onClick={deleteActiveBarcodePreset} disabled={activeBarcodePreset.builtIn} className="btn-secondary btn-sm disabled:opacity-50">
                Delete Custom
              </button>
              <button
                type="button"
                onClick={() => handleSettingChange("barcodeStickerPresetId", BUILT_IN_BARCODE_PRESETS[0].id)}
                className="btn-secondary btn-sm"
              >
                Reset
              </button>
            </div>
          </div>

          {canConfigureBarcodePrinting && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Barcode PDF Preview Apps</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Normal barcode printing remains automatic. Use a PDF app here only to test the sample layout and orientation during setup.
                  </p>
                </div>
                <button type="button" onClick={openPdfRepairSettings} className="btn-secondary btn-sm shrink-0">
                  Repair Windows PDF Access
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pdfViewers.map((viewer) => {
                  const enabled = getEnabledPdfViewerIds().includes(viewer.id);
                  const preferred = (settings.barcodePdfViewerPreferredId || "system") === viewer.id;
                  return (
                    <div key={viewer.id} className="rounded-lg border border-blue-100 bg-white p-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => togglePdfViewer(viewer.id, event.target.checked)}
                          className="mt-1 h-5 w-5"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900">{viewer.name}</span>
                          <span className={`block text-xs ${viewer.installed ? "text-green-700" : "text-gray-500"}`}>
                            {viewer.installed ? "Available" : "Not detected on this computer"}
                          </span>
                        </span>
                      </label>
                      <label className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-700">
                        <input
                          type="radio"
                          name="preferredBarcodePdfViewer"
                          checked={preferred}
                          disabled={!enabled}
                          onChange={() => handleSettingChange("barcodePdfViewerPreferredId", viewer.id)}
                        />
                        Preferred preview app
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-gray-600">
                PDF pages keep the configured physical size and orientation. In an external app, print using Actual size or 100% scale.
              </p>
              {barcodeAppPreviewSupported && (
                <button
                  type="button"
                  onClick={openBarcodeSample}
                  disabled={openingBarcodeSample}
                  className="btn-primary btn-sm mt-3 disabled:opacity-50"
                >
                  {openingBarcodeSample ? "Opening Sample..." : "Open Sample in PDF App"}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {isGa2408tPreset && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  Vertical roll feed is fixed at 102 × 25 mm with three stickers across. Copies fill left to right; saved orientation values from older versions are safely ignored for this media.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Active Preset</label>
                  <select
                    value={settings.barcodeStickerPresetId || BUILT_IN_BARCODE_PRESETS[0].id}
                    onChange={(e) => handleSettingChange("barcodeStickerPresetId", e.target.value)}
                    className="input-base"
                  >
                    {barcodePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}{preset.builtIn ? " (Built-in)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Preset Name</label>
                  <input
                    type="text"
                    value={activeBarcodePreset.name}
                    onChange={(e) => updateActiveBarcodePreset({ name: e.target.value })}
                    className="input-base"
                  />
                </div>
                {barcodeAppPreviewSupported && !isGa2408tPreset && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Orientation</label>
                    <select
                      value={activeBarcodePreset.orientation || "horizontal"}
                      onChange={(e) => updateActiveBarcodePreset({ orientation: e.target.value as BarcodeStickerPreset["orientation"] })}
                      className="input-base"
                    >
                      <option value="vertical">Vertical (Portrait)</option>
                      <option value="horizontal">Horizontal (Landscape)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Width mm", "stickerWidthMm"],
                  ["Height mm", "stickerHeightMm"],
                  ["Columns", "columns"],
                  ["Rows", "rows"],
                  ["Max Roll mm", "maxRollLengthMm"],
                  ["Column Gap", "columnGapMm"],
                  ["Row Gap", "rowGapMm"],
                  ["Barcode H", "barcodeHeightMm"],
                  ["Bar Width", "barcodeBarWidth"],
                  ["Left Margin", "marginLeftMm"],
                  ["Right Margin", "marginRightMm"],
                  ["Top Margin", "marginTopMm"],
                  ["Bottom Margin", "marginBottomMm"],
                  ["Name Font", "productNameFontSize"],
                  ["Price Font", "sellingPriceFontSize"],
                  ["Least Font", "leastPriceFontSize"],
                  ["Code Font", "leastPriceCodeFontSize"],
                  ["Barcode Text Font", "barcodeTextFontSize"],
                  ["Business Name Font", "businessInfoFontSize"],
                  ["Address Font", "businessAddressFontSize"],
                  ["Phone Font", "businessPhoneFontSize"],
                ].map(([label, key]) => (
                  <label key={key} className="block text-sm font-medium text-gray-900">
                    {label}
                    <input
                      type="number"
                      min={key === "barcodeBarWidth" ? 0.8 : key === "barcodeTextFontSize" ? 4 : 0}
                      max={key === "barcodeTextFontSize" ? 12 : undefined}
                      step={key === "barcodeBarWidth" ? 0.1 : 1}
                      value={Number(activeBarcodePreset[key as keyof BarcodeStickerPreset])}
                      onChange={(e) => updateActiveBarcodePreset({ [key]: Number(e.target.value) } as Partial<BarcodeStickerPreset>)}
                      className="input-base mt-1"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  ["Product Name", "showProductName"],
                  ["Selling Price", "showSellingPrice"],
                  ["Least Price", "showLeastPrice"],
                  ["Least Code", "showLeastPriceCode"],
                  ["Barcode Text", "showBarcodeText"],
                  ["Business Name", "showBusinessName"],
                  ["Business Address", "showBusinessAddress"],
                  ["Business Phone", "showBusinessPhone"],
                ].map(([label, key]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={Boolean(activeBarcodePreset[key as keyof BarcodeStickerPreset])}
                      onChange={(e) => updateActiveBarcodePreset({ [key]: e.target.checked } as Partial<BarcodeStickerPreset>)}
                      className="w-5 h-5"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">Field Order & Spacing</p>
                <div className="space-y-2">
                  {(activeBarcodePreset.fieldOrder || DEFAULT_BARCODE_FIELD_ORDER).map((field, index, order) => {
                    const definition = BARCODE_FIELD_DEFINITIONS.find((item) => item.id === field);
                    const hidden = !isBarcodeFieldVisible(activeBarcodePreset, field);
                    return (
                      <div
                        key={field}
                        className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center rounded-lg bg-gray-50 p-3 ${hidden ? "opacity-60" : ""}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {definition?.label || field}
                          </p>
                          <p className="text-xs text-gray-500">
                            {hidden ? "Hidden" : "Visible"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveBarcodeField(field, -1)}
                            disabled={index === 0}
                            className="rounded border border-gray-300 bg-white p-2 text-gray-700 disabled:opacity-40"
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBarcodeField(field, 1)}
                            disabled={index === order.length - 1}
                            className="rounded border border-gray-300 bg-white p-2 text-gray-700 disabled:opacity-40"
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                        <label className="text-xs font-medium text-gray-700">
                          Gap mm
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={getBarcodeFieldGapMm(activeBarcodePreset, field)}
                            onChange={(e) => updateBarcodeFieldGap(field, Number(e.target.value))}
                            className="input-base mt-1 w-24"
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          Align
                          <select
                            value={getBarcodeFieldAlignment(activeBarcodePreset, field)}
                            onChange={(e) =>
                              updateBarcodeFieldAlignment(
                                field,
                                e.target.value as BarcodeStickerFieldAlignment
                              )
                            }
                            className="input-base mt-1 w-28"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 overflow-auto">
              <p className="text-sm font-semibold text-gray-900 mb-3">Live Preview</p>
              <div
                className="grid bg-white border border-dashed border-gray-300"
                style={{
                  gridTemplateColumns: isGa2408tPreset
                    ? "repeat(3, 94px)"
                    : `repeat(${activeBarcodePreset.columns}, ${Math.min(140, activeBarcodePreset.stickerWidthMm * 2.1)}px)`,
                  gap: isGa2408tPreset
                    ? "0 12px"
                    : `${Math.max(4, activeBarcodePreset.rowGapMm * 2)}px ${Math.max(4, activeBarcodePreset.columnGapMm * 2)}px`,
                  padding: isGa2408tPreset ? 0 : `${Math.max(6, activeBarcodePreset.marginTopMm * 2)}px`,
                  width: isGa2408tPreset ? "318px" : undefined,
                }}
              >
                {Array.from({ length: Math.min(12, activeBarcodePreset.columns * activeBarcodePreset.rows) }).map((_, index) => (
                  <div
                    key={index}
                    className="border border-gray-300 bg-white text-center overflow-hidden flex flex-col justify-center"
                    style={{
                      width: isGa2408tPreset ? "94px" : `${Math.min(140, activeBarcodePreset.stickerWidthMm * 2.1)}px`,
                      height: isGa2408tPreset ? "75px" : `${Math.min(110, activeBarcodePreset.stickerHeightMm * 2.1)}px`,
                      padding: isGa2408tPreset ? "2px 1px" : undefined,
                      justifyContent: isGa2408tPreset ? "flex-start" : undefined,
                    }}
                  >
                    {(activeBarcodePreset.fieldOrder || DEFAULT_BARCODE_FIELD_ORDER)
                      .filter((field) => isBarcodeFieldVisible(activeBarcodePreset, field))
                      .map((field) => renderPreviewBarcodeField(field))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Barcode Scanner Preferences */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Barcode Scanner Preferences
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Sound Alert</h3>
                <p className="text-sm text-gray-600">
                  Play sound when item is scanned
                </p>
              </div>
              <input
                type="checkbox"
                checked={barcodeScannerSettings.soundAlert}
                onChange={(e) =>
                  handleBarcodeScannerChange("soundAlert", e.target.checked)
                }
                className="w-6 h-6 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Auto Focus</h3>
                <p className="text-sm text-gray-600">
                  Auto-focus barcode input field
                </p>
              </div>
              <input
                type="checkbox"
                checked={barcodeScannerSettings.autoFocus}
                onChange={(e) =>
                  handleBarcodeScannerChange("autoFocus", e.target.checked)
                }
                className="w-6 h-6 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Notification Settings
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Low Stock Alert</h3>
                <p className="text-sm text-gray-600">
                  Get notified when stock is low
                </p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.lowStockAlert}
                onChange={(e) =>
                  handleNotificationChange("lowStockAlert", e.target.checked)
                }
                className="w-6 h-6 cursor-pointer"
              />
            </div>

            {notificationSettings.lowStockAlert && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  value={notificationSettings.lowStockThreshold}
                  onChange={(e) =>
                    handleNotificationChange(
                      "lowStockThreshold",
                      parseInt(e.target.value)
                    )
                  }
                  className="input-base"
                  min="1"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Alert when quantity falls below this number
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Daily Report</h3>
                <p className="text-sm text-gray-600">
                  Receive daily sales report at 6 PM
                </p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.dailyReport}
                onChange={(e) =>
                  handleNotificationChange("dailyReport", e.target.checked)
                }
                className="w-6 h-6 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Data Backup */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Backup Data</h2>
          </div>

          <input
            ref={restoreInputRef}
            type="file"
            accept=".sqlite,.db,.json,application/json,application/vnd.sqlite3,application/octet-stream"
            onChange={handleRestoreBackup}
            className="hidden"
          />

          <div className="mb-5 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">Automatic Daily Backup</p>
                <p className="text-sm text-gray-600">Save one backup per day to a selected local folder.</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.autoBackupEnabled)}
                onChange={(e) => handleSettingChange("autoBackupEnabled", e.target.checked)}
                className="h-6 w-6 cursor-pointer"
              />
            </label>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm font-medium text-gray-900">
                Backup Folder
                <div className="mt-1 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={settings.autoBackupFolderPath || ""}
                    readOnly
                    className="input-base bg-white"
                    placeholder="No folder selected"
                  />
                  <button
                    type="button"
                    onClick={handleChooseBackupFolder}
                    disabled={backupWorking !== null}
                    className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <FolderOpen className="w-4 h-4" />
                    {backupWorking === "folder" ? "Choosing..." : "Choose Folder"}
                  </button>
                </div>
              </label>

              {(settings.autoBackupLastStatus || settings.autoBackupLastMessage) && (
                <div className="rounded-lg bg-white p-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">
                    Last status: {settings.autoBackupLastStatus || "unknown"}
                  </p>
                  {settings.autoBackupLastMessage && (
                    <p className="mt-1">{settings.autoBackupLastMessage}</p>
                  )}
                  {settings.autoBackupLastRunAt && (
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(settings.autoBackupLastRunAt).toLocaleString()}
                    </p>
                  )}
                  {settings.autoBackupLastPath && (
                    <p className="mt-1 break-all text-xs text-gray-500">
                      {settings.autoBackupLastPath}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleRunAutoBackup}
                disabled={backupWorking !== null || !settings.autoBackupEnabled}
                className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Database className="w-4 h-4" />
                {backupWorking === "auto" ? "Checking Backup..." : "Run Auto Backup Check"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={backupWorking !== null}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {backupWorking === "download" ? "Preparing Backup..." : "Download Backup"}
            </button>
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              disabled={backupWorking !== null || (settings.backupRestoreAdminOnlyEnabled !== false && user?.role !== "admin")}
              className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              title={
                settings.backupRestoreAdminOnlyEnabled !== false && user?.role !== "admin"
                  ? "Only admins can restore backups"
                  : "Restore Backup"
              }
            >
              <Upload className="w-5 h-5" />
              {backupWorking === "restore" ? "Restoring Backup..." : "Restore Backup"}
            </button>
          </div>
        </div>

        {/* User Credentials */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">User Credentials</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Create each user with an email and password. The password is hashed and saved in the database, so keep the plain password safely when you create or reset it.
          </p>

          {savedCredential && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Save these credentials now</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-blue-900">
                <div>
                  <span className="font-medium">Email:</span> {savedCredential.email}
                </div>
                <div>
                  <span className="font-medium">Password:</span> {savedCredential.password}
                </div>
              </div>
              <p className="text-xs text-blue-800 mt-2">{savedCredential.note}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-gray-900">Create User</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Name</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                    className="input-base"
                    placeholder="Cashier User"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                    className="input-base"
                    placeholder="cashier@pos.com"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                      className="input-base"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager - Today reports</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Password</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                      className="input-base"
                      placeholder="Create password"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateUser}
                  disabled={savingUser}
                  className="btn-success flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {savingUser ? "Saving user..." : "Create & Save"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <RotateCcw className="w-4 h-4 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Reset Password</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                  <input
                    type="email"
                    value={resetForm.email}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="input-base"
                    placeholder="user@pos.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">New Password</label>
                  <input
                    type="password"
                    value={resetForm.password}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="input-base"
                    placeholder="Enter new password"
                  />
                </div>
                <button
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                  className="btn-primary flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {resettingPassword ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="font-semibold text-gray-900">Saved Users</h3>
              <button onClick={() => fetchUsers()} className="text-sm text-blue-600 hover:text-blue-700">
                Refresh
              </button>
            </div>
            {usersLoading ? (
              <p className="text-sm text-gray-600">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-600">No users found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {users.map((user) => (
                  <div key={user.id} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{user.name || user.email}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                      <span className="uppercase tracking-[0.18em]">{user.role}</span>
                      <div className="flex items-center gap-3"><span>{new Date(user.created_at).toLocaleDateString()}</span>{canMaintain && <><button type="button" onClick={() => updateManagedUser(user)} className="text-blue-600">Edit</button><button type="button" onClick={() => deleteManagedUser(user)} className="text-red-600">Delete</button></>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {canMaintain && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Admin Maintenance</h2>
                <p className="text-sm text-gray-600">Review or correct return records without changing normal employee workflows.</p>
              </div>
              <button type="button" onClick={() => fetchMaintenanceRecords()} className="text-sm text-blue-600 hover:text-blue-700">Refresh</button>
            </div>
            {maintenanceReturns.length === 0 ? (
              <p className="text-sm text-gray-600">No return records found.</p>
            ) : (
              <div className="space-y-2">
                {maintenanceReturns.map((record) => (
                  <div key={record.id} className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Return {record.id}</p>
                      <p className="text-xs text-gray-600">Transaction {record.original_transaction_id} · {record.reason || "No reason"}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="capitalize text-gray-600">{record.status || "pending"}</span>
                      <button type="button" onClick={() => updateReturnStatus(record)} className="text-blue-600">Edit</button>
                      <button type="button" onClick={() => deleteReturn(record)} className="text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-success flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Settings
          </button>
        </div>
      </div>

      {showTransactionDeleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Enable transaction deletion?
              </h2>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <p>Transaction deletion is permanent.</p>
              <p>Deleted sales will be removed from reports.</p>
              <p>Stock from the deleted transaction will be restored.</p>
              <p>This should only be used for mistaken transactions.</p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowTransactionDeleteWarning(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmTransactionDeleteSetting}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
              >
                Enable Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
