import type { IndustryMode } from "@/types";

export const CATEGORY_PRESETS: Record<IndustryMode, string[]> = {
  general: ["Products", "Accessories", "Services", "Consumables"],
  sports: [
    "Sports Shoes",
    "School Shoes",
    "Travel Bags",
    "School Bags",
    "Slippers",
    "Sandals",
    "Belts",
  ],
  mechanical: [
    "Engine Parts",
    "Body Parts",
    "Lubricants",
    "Tools",
    "Tyres",
    "Services",
  ],
  medical: [
    "Medicines",
    "Consumables",
    "Devices",
    "Supplements",
    "Diagnostics",
  ],
  fashion: ["Clothing", "Footwear", "Bags", "Accessories", "Beauty"],
  electronics: ["Phones", "Accessories", "Computers", "Audio", "Gadgets"],
  grocery: ["Rice", "Dry Goods", "Beverages", "Snacks", "Household"],
};

export function getCategoryPresets(mode: IndustryMode) {
  return CATEGORY_PRESETS[mode] || CATEGORY_PRESETS.general;
}

export function getStoredIndustryMode() {
  if (typeof window === "undefined") {
    return "general" as IndustryMode;
  }

  try {
    const raw = localStorage.getItem("posSettings");
    if (!raw) return "general" as IndustryMode;

    const parsed = JSON.parse(raw) as { industryMode?: IndustryMode };
    return parsed.industryMode || ("general" as IndustryMode);
  } catch {
    return "general" as IndustryMode;
  }
}