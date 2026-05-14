"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/pos", label: "POS System", icon: ShoppingCart },
    { href: "/products", label: "Products", icon: Package },
    { href: "/transactions", label: "Transactions", icon: ShoppingCart },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-40 lg:hidden"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 w-64 bg-gray-900 text-white transform transition-transform duration-300 z-30 lg:relative lg:transform-none ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-gray-800">
          <a href="/" className="flex items-center gap-2">
            <ShoppingCart className="w-8 h-8" />
            <h1 className="text-xl font-bold">Sports Shop POS</h1>
          </a>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === href
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ml-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
