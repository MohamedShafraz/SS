export const SITE = {
  name: "MSHPOS",
  supportEmail: "mshpos@proton.me",
  description: "A focused point-of-sale system for independent retailers and growing shops.",
  storeUrl: process.env.NEXT_PUBLIC_MICROSOFT_STORE_URL?.trim() || "",
  privacyUrl: "/privacy-policy",
} as const;

export const FEATURES = [
  { title: "Fast checkout", text: "Search, scan, discount, and complete sales from one focused counter screen." },
  { title: "Products and variants", text: "Organize products, sizes, colors, SKUs, and stock without losing the detail." },
  { title: "Barcode workflows", text: "Generate labels and use a keyboard-style barcode reader for faster billing." },
  { title: "Inventory control", text: "Keep quantities, low-stock decisions, suppliers, and purchase context together." },
  { title: "Receipts and returns", text: "Print receipts, find past sales, and process returns or replacements clearly." },
  { title: "Reports and accounting", text: "See sales, profit, inventory value, shop balances, and daily performance." },
  { title: "Local backups", text: "Keep business data on the Windows device and create administrator-controlled backups." },
  { title: "Staff roles", text: "Give administrators, managers, and cashiers the access each role needs." },
] as const;

export const INDUSTRIES = [
  { name: "General retail", image: "/Retail_shop.jpeg", text: "Mixed products, everyday checkout, and simple stock control." },
  { name: "Sports shops", image: "/Sports_shop.jpeg", text: "Sizes, variants, footwear, bags, and seasonal stock." },
  { name: "Fashion and boutiques", image: "/Fashion_boutique.jpeg", text: "Neat collections, accessories, and size-based inventory." },
  { name: "Electronics", image: "/Electronics_store.jpeg", text: "Fast-moving gadgets, accessories, and invoice-ready sales." },
] as const;

export function validStoreUrl(value = SITE.storeUrl) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 ? url.toString() : "";
  } catch {
    return "";
  }
}

export function onlinePosHref() {
  const subject = encodeURIComponent("Online POS enquiry");
  const body = encodeURIComponent(
    "Hello MSHPOS,\n\nI would like to discuss a custom online POS.\nBusiness name:\nShop type:\nNumber of locations:\nBest contact details:\n"
  );
  return `mailto:${SITE.supportEmail}?subject=${subject}&body=${body}`;
}
