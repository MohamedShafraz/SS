import type { IndustryMode } from "@/types";

export interface ShopTemplate {
  mode: IndustryMode;
  title: string;
  subtitle: string;
  description: string;
  bestFor: string;
  accent: string;
  categoryFocus: string[];
}

export const SHOP_TEMPLATES: ShopTemplate[] = [
  {
    mode: "general",
    title: "General Retail Shop",
    subtitle: "Simple multi-category retail",
    description:
      "Ideal for shops that sell mixed products and need fast checkout, stock control, and daily reporting.",
    bestFor: "Small retail stores and neighborhood shops",
    accent: "from-slate-900 to-slate-600",
    categoryFocus: ["Products", "Accessories", "Services", "Consumables"],
  },
  {
    mode: "sports",
    title: "Sports Shop",
    subtitle: "Shoes, bags, and seasonal stock",
    description:
      "Built for size-based inventory, product variants, and category-led sales for sporting goods retailers.",
    bestFor: "Sportswear and footwear stores",
    accent: "from-blue-700 to-cyan-500",
    categoryFocus: [
      "Sports Shoes",
      "School Shoes",
      "Travel Bags",
      "School Bags",
      "Slippers",
      "Sandals",
      "Belts",
    ],
  },
  {
    mode: "fashion",
    title: "Fashion & Boutique",
    subtitle: "Clothing with premium presentation",
    description:
      "Works well for apparel stores that need neat collections, size variants, and clean category separation.",
    bestFor: "Boutiques, clothing shops, accessory stores",
    accent: "from-rose-600 to-orange-400",
    categoryFocus: ["Clothing", "Footwear", "Bags", "Accessories", "Beauty"],
  },
  {
    mode: "electronics",
    title: "Electronics Store",
    subtitle: "Fast-moving gadgets and accessories",
    description:
      "Designed for item-level tracking, serial-friendly inventory, and customer-ready invoice handling.",
    bestFor: "Mobile, computer, and accessory stores",
    accent: "from-violet-700 to-sky-500",
    categoryFocus: ["Phones", "Accessories", "Computers", "Audio", "Gadgets"],
  },
  {
    mode: "grocery",
    title: "Mini Mart / Grocery",
    subtitle: "High-volume low-margin sales",
    description:
      "Keeps everyday essentials moving with quick search, low-stock alerts, and simple replenishment controls.",
    bestFor: "Mini marts, grocery stores, household stores",
    accent: "from-emerald-700 to-teal-500",
    categoryFocus: ["Rice", "Dry Goods", "Beverages", "Snacks", "Household"],
  },
  {
    mode: "medical",
    title: "Medical Shop",
    subtitle: "Compliance-friendly selling",
    description:
      "Supports careful stock management for medicines, devices, and consumables in health-focused shops.",
    bestFor: "Pharmacies and medical supply stores",
    accent: "from-cyan-700 to-blue-400",
    categoryFocus: ["Medicines", "Consumables", "Devices", "Supplements", "Diagnostics"],
  },
  {
    mode: "mechanical",
    title: "Mechanical / Auto Parts",
    subtitle: "Parts, services, and repairs",
    description:
      "Best for auto parts counters and repair shops that need categorized parts, services, and invoices.",
    bestFor: "Garages, auto parts, and repair shops",
    accent: "from-amber-700 to-orange-500",
    categoryFocus: ["Engine Parts", "Body Parts", "Lubricants", "Tools", "Tyres", "Services"],
  },
];

export function getShopTemplate(mode: IndustryMode) {
  return SHOP_TEMPLATES.find((template) => template.mode === mode) ?? SHOP_TEMPLATES[0];
}
