"use client";

import { MainLayout } from "@/components/layout";
import type { BusinessProfile } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { Save, AlertCircle, Users, UserPlus, RotateCcw, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { SHOP_TEMPLATES } from "@/lib/shop-offerings";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BusinessProfile>({
    businessName: "Unified Business",
    address: "123 Main Street, City",
    phone: "+94 77 712 3456",
    email: "info@business.com",
    taxRate: 5,
    currency: "/=",
    businessType: "Retail",
    barcodePrefix: "BCD",
    industryMode: "general",
    receiptLayout: "standard",
    receiptPaperWidth: "80mm",
    showReceiptBusinessInfo: true,
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
  const [savedCredential, setSavedCredential] = useState<{
    email: string;
    password: string;
    note: string;
  } | null>(null);

  const handleSettingChange = (
    key: keyof BusinessProfile,
    value: string | number | boolean
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleBarcodeScannerChange = (key: string, value: boolean) => {
    setBarcodeScannerSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleNotificationChange = (key: string, value: boolean | number) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: value }));
  };

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

  const handleSave = async () => {
    localStorage.setItem("posSettings", JSON.stringify(settings));
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
        body: JSON.stringify({ settings }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to save settings");
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings saved locally only");
    }
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
                <input
                  type="text"
                  value={settings.currency}
                  onChange={(e) =>
                    handleSettingChange("currency", e.target.value)
                  }
                  className="input-base"
                  maxLength={3}
                />
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
        </div>

        {/* Barcode Scanner Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Barcode Scanner Settings
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Enable Scanner</h3>
                <p className="text-sm text-gray-600">
                  Enable barcode scanning in POS system
                </p>
              </div>
              <input
                type="checkbox"
                checked={barcodeScannerSettings.enabled}
                onChange={(e) =>
                  handleBarcodeScannerChange("enabled", e.target.checked)
                }
                className="w-6 h-6 cursor-pointer"
              />
            </div>

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

        {/* Shop Templates */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Shop Templates
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Each shop gets its own category set so your POS stays organized by industry.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SHOP_TEMPLATES.map((template) => (
              <div
                key={template.mode}
                className="rounded-xl border border-gray-200 p-5 bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {template.title}
                    </h3>
                    <p className="text-sm text-gray-600">{template.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-4">{template.description}</p>
                <div className="flex flex-wrap gap-2">
                  {template.categoryFocus.slice(0, 5).map((item) => (
                    <span
                      key={item}
                      className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
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
                      <span>{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-success flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Settings
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
