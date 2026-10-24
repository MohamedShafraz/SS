"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const screens = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "See the shop at a glance.",
    text: "Review sales, profit, loss, inventory value, and category performance from one focused dashboard.",
    image: "/product-tour/dashboard.png",
    width: 1920,
    height: 1020,
  },
  {
    id: "dashboard-today",
    label: "Today view",
    title: "Filter the numbers that matter now.",
    text: "Switch reporting periods and categories to focus on the current trading picture.",
    image: "/product-tour/dashboard-today.png",
    width: 1920,
    height: 1080,
  },
  {
    id: "pos",
    label: "POS",
    title: "Keep checkout moving.",
    text: "Search products, add items to the cart, apply discounts, choose a payment method, and complete the sale.",
    image: "/product-tour/pos.png",
    width: 1920,
    height: 1020,
  },
  {
    id: "products",
    label: "Products",
    title: "Keep products and stock organised.",
    text: "Search the catalogue, filter categories, review margins, and manage stock from one workspace.",
    image: "/product-tour/products.png",
    width: 1920,
    height: 1020,
  },
  {
    id: "product-editor",
    label: "Product editor",
    title: "Capture the details behind every item.",
    text: "Update pricing, cost, quantity, SKU, images, and product variants as your catalogue changes.",
    image: "/product-tour/product-editor.png",
    width: 1920,
    height: 1020,
  },
  {
    id: "transactions",
    label: "Transactions",
    title: "Find the history behind every sale.",
    text: "Review sales and returns, payment methods, receipts, and transaction actions in one place.",
    image: "/product-tour/transactions.png",
    width: 1920,
    height: 1020,
  },
] as const;

export function ProductTour() {
  type ScreenId = (typeof screens)[number]["id"];
  const [activeId, setActiveId] = useState<ScreenId>(screens[0].id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(0, screens.findIndex((item) => item.id === activeId));
  const screen = screens[activeIndex];

  function select(id: ScreenId) {
    setActiveId(id);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = (index + 1) % screens.length;
      select(screens[next].id);
      tabRefs.current[next]?.focus();
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const previous = (index - 1 + screens.length) % screens.length;
      select(screens[previous].id);
      tabRefs.current[previous]?.focus();
    }
  }

  return (
    <section className="border-y border-slate-200 bg-slate-50" id="product-tour" aria-labelledby="product-tour-title">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Inside MSHPOS</p>
          <h2 className="section-title" id="product-tour-title">Explore the workflows before you install.</h2>
          <p className="mt-4 leading-7 text-slate-600">Select a screen to see how the offline Windows POS supports the everyday work behind the counter.</p>
        </div>

        <div className="mt-8 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="MSHPOS product screens">
          {screens.map((item, index) => (
            <button
              aria-controls="product-tour-panel"
              aria-selected={activeId === item.id}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${activeId === item.id ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700"}`}
              id={`product-tour-tab-${item.id}`}
              key={item.id}
              onClick={() => select(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => { tabRefs.current[index] = element; }}
              role="tab"
              tabIndex={activeId === item.id ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-8 overflow-hidden rounded-3xl bg-black/90 p-4 text-white shadow-xl lg:grid-cols-[1fr_0.7fr] lg:items-center lg:p-6" id="product-tour-panel" role="tabpanel" aria-labelledby={`product-tour-tab-${screen.id}`}>
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <div className="relative aspect-video">
              <Image className="object-contain" src={screen.image} alt={`${screen.label} screen in MSHPOS`} fill sizes="(max-width: 1024px) 100vw, 65vw" priority={activeIndex === 0} />
            </div>
          </div>
          <div className="px-2 py-4 lg:px-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">{screen.label}</p>
            <h3 className="mt-4 text-3xl font-semibold tracking-tight">{screen.title}</h3>
            <p className="mt-4 leading-7 text-slate-300">{screen.text}</p>
            <p className="mt-8 text-sm text-slate-400">Use the arrow keys when the screen tabs are focused.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
