"use client";

// import Link from "next/link";
import { BarChart3, Package, ShoppingCart, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Sports Shop POS</h1>
            </div>
            <div className="flex gap-4">
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/pos"
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                POS System
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Sports Shop POS System
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Modern, responsive, and feature-rich point of sale system for your sports retail business
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Feature Cards */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 mb-4">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Sales</h3>
            <p className="text-gray-600">Fast and easy checkout process with barcode scanning</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 mb-4">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Inventory</h3>
            <p className="text-gray-600">Manage products, stock levels, and barcode labels</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 mb-4">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
            <p className="text-gray-600">Detailed sales, profit, and loss reports with charts</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-100 mb-4">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Discounts</h3>
            <p className="text-gray-600">Create discounts for products, categories, or bundles</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/pos"
            className="px-8 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors text-center"
          >
            Start Selling
          </a>
          <a
            href="/products"
            className="px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-center"
          >
            Manage Products
          </a>
          <a
            href="/dashboard"
            className="px-8 py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors text-center"
          >
            View Dashboard
          </a>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white mt-16 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Key Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✓ Barcode Integration
              </h3>
              <p className="text-gray-600">
                Generate barcode stickers for products and connect barcode readers for seamless scanning
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✓ Product Management
              </h3>
              <p className="text-gray-600">
                Add products with images, track inventory, and manage multiple categories
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✓ Flexible Pricing
              </h3>
              <p className="text-gray-600">
                Apply discounts per product, category, bundle, or custom pricing
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✓ Mobile Responsive
              </h3>
              <p className="text-gray-600">
                Works seamlessly on desktop, tablet, and mobile devices
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✓ Real-time Analytics
              </h3>
              <p className="text-gray-600">
                Dashboard with sales, profit/loss, inventory tracking by date and category
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✓ Easy Access
              </h3>
              <p className="text-gray-600">
                Deployed on Vercel with Supabase backend for reliability
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
