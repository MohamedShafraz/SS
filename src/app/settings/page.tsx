"use client";

import { MainLayout } from "@/components/layout";
import { useState } from "react";
import { Save, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    shopName: "Sports Shop",
    address: "123 Main Street, City",
    phone: "+91 98765 43210",
    email: "info@sportsshop.com",
    taxRate: 5,
    currency: "/=",
    businessType: "Retail",
    barcodePrefix: "BCD",
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

  const handleSettingChange = (key: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleBarcodeScannerChange = (key: string, value: boolean) => {
    setBarcodeScannerSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleNotificationChange = (key: string, value: boolean | number) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save to local storage or API
    localStorage.setItem("posSettings", JSON.stringify(settings));
    localStorage.setItem(
      "barcodeScannerSettings",
      JSON.stringify(barcodeScannerSettings)
    );
    localStorage.setItem(
      "notificationSettings",
      JSON.stringify(notificationSettings)
    );
    toast.success("Settings saved successfully!");
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
            Shop Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Shop Name
              </label>
              <input
                type="text"
                value={settings.shopName}
                onChange={(e) =>
                  handleSettingChange("shopName", e.target.value)
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
