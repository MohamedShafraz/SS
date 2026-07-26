"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Menu,
  X,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Store,
  UserCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const navigationItems = {
  cashier: [{ href: "/pos", label: "Sales Register", icon: ShoppingCart }],
  manager: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pos", label: "Sales Register", icon: ShoppingCart },
    { href: "/products", label: "Inventory", icon: Package },
    { href: "/transactions", label: "Sales History", icon: ReceiptText },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pos", label: "Sales Register", icon: ShoppingCart },
    { href: "/products", label: "Inventory", icon: Package },
    { href: "/transactions", label: "Sales History", icon: ReceiptText },
    { href: "/settings", label: "Administration", icon: Settings },
  ],
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Sales Register",
  "/products": "Inventory",
  "/transactions": "Sales History",
  "/settings": "Administration",
};

function getRoleLabel(role?: string) {
  if (!role) return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getPageTitle(pathname: string) {
  const match = Object.entries(pageTitles).find(([href]) =>
    pathname === href || pathname.startsWith(`${href}/`)
  );
  return match?.[1] || "Back Office";
}

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const role =
    user?.role === "cashier" || user?.role === "admin" ? user.role : "manager";
  const menuItems = navigationItems[role];

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-slate-950 text-slate-100 shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
          <a href="/" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-blue-600">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-normal">MSHPOS</h1>
              <p className="truncate text-xs text-slate-400">Retail operations</p>
            </div>
          </a>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:bg-slate-900 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-blue-300" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-200">
                {getRoleLabel(user?.role)} access
              </p>
              <p className="truncate text-[11px] text-slate-500">Navigation is role based</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {menuItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              onClick={onClose}
              className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white active:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </a>
          ))}
        </nav>

        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
          <p className="truncate">Store terminal</p>
          <p className="truncate text-slate-400">Back-office console</p>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950 bg-opacity-50 transition-opacity lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const displayName = user?.name?.trim() || user?.email || "User";
  const pageTitle = getPageTitle(pathname);

  // Client-side guard: ensure cashier can't access non-POS routes
  useEffect(() => {
    if (!user) return;
    if (user.role === "cashier" && !pathname.startsWith("/pos")) {
      router.push("/pos");
    }
  }, [user, pathname, router]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {user && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        {user && (
          <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">
                  {pageTitle}
                </p>
                <p className="truncate text-xs text-slate-500">MSHPOS operations console</p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 items-center gap-2 border-r border-slate-200 pr-3 sm:flex">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{getRoleLabel(user.role)}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="flex h-10 flex-shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
