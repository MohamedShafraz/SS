"use client";

// import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, CheckCircle2 } from "lucide-react";
import { LOW_COST_PLANS } from "@/lib/shop-offerings";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_38%,_#f8fafc_100%)] text-slate-900">
      <nav className="border-b border-white/70 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Retail control system</p>
              <h1 className="text-lg sm:text-xl font-semibold">MSHPOS</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/pos"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Open POS
            </a>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-slate-200 text-sm font-medium text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Built for single shops and multi-shop operations
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight text-slate-950">
                Industry-level POS for every shop, without the heavy cost.
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl">
                Set up different shop types, keep categories separate, and choose a low-cost plan that matches your size today and your growth tomorrow.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/pos"
                className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors text-center"
              >
                Start Selling
              </a>
              <a
                href="/settings"
                className="px-6 py-3 rounded-xl bg-white text-slate-800 font-semibold border border-slate-200 hover:border-slate-300 transition-colors text-center"
              >
                Configure Shops
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                "Separate shop templates",
                "Low-cost monthly plans",
                "Variant and stock tracking",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/80 border border-white/70 p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                {
                  src: "/Retail_shop.jpeg",
                  title: "General Retail Shop",
                  subtitle: "Simple multi-category retail",
                },
                {
                  src: "/Sports_shop.jpeg",
                  title: "Sports Shop",
                  subtitle: "Shoes, bags, and seasonal stock",
                },
                {
                  src: "/Fashion_boutique.jpeg",
                  title: "Fashion & Boutique",
                  subtitle: "Clothing with premium presentation",
                },
                {
                  src: "/Electronics_store.jpeg",
                  title: "Electronics Store",
                  subtitle: "Fast-moving gadgets and accessories",
                },
              ].map((shop) => (
                <div
                  key={shop.title}
                  className="group relative overflow-hidden rounded-[1.6rem] bg-slate-950 shadow-xl shadow-slate-300/40 border border-white/60 min-h-[200px] sm:min-h-[240px]"
                >
                  <Image
                    src={shop.src}
                    alt={shop.title}
                    fill
                    priority={shop.title === "General Retail Shop"}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">{shop.title}</p>
                    <p className="text-sm sm:text-base font-semibold leading-tight">{shop.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 rounded-3xl bg-slate-950 text-white p-8 shadow-2xl shadow-slate-300/40">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400 mb-3">What you get</p>
            <h3 className="text-2xl font-semibold mb-4">A cleaner retail workflow</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-300">
              {[
                "Fast barcode checkout",
                "Category-based inventory",
                "Daily sales analytics",
                "Low-stock alerts",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white p-8 border border-slate-200 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-2">Low-cost starter</p>
            <p className="text-4xl font-bold text-slate-950">LKR 2,990</p>
            <p className="text-slate-600 mt-2">One shop, billing, inventory, and reports.</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white p-8 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-blue-100 mb-2">Best value</p>
            <p className="text-4xl font-bold">LKR 4,990</p>
            <p className="text-blue-50 mt-2">Up to 3 shops with templates and variants.</p>
          </div>
        </div>
      </section>

      <section className="bg-white/80 border-y border-white/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500 mb-2">Pricing</p>
              <h3 className="text-3xl font-bold text-slate-950">Low-cost plans for every shop size</h3>
            </div>
            <p className="text-slate-600 max-w-2xl">
              Pick a plan that fits the number of shops you run. Upgrade only when your branches and staff actually need more.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LOW_COST_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl p-6 border shadow-sm ${
                  plan.highlighted
                    ? "bg-slate-950 text-white border-slate-950 shadow-xl"
                    : "bg-white border-slate-200"
                }`}
              >
                {plan.highlighted ? (
                  <span className="inline-flex px-3 py-1 rounded-full bg-white/10 text-xs font-semibold mb-4">
                    Best Value
                  </span>
                ) : null}
                <h4 className="text-xl font-semibold mb-2">{plan.name}</h4>
                <p className={`text-4xl font-bold mb-2 ${plan.highlighted ? "text-white" : "text-slate-950"}`}>
                  {plan.price}
                  <span className="text-base font-medium">{plan.billing}</span>
                </p>
                <p className={plan.highlighted ? "text-slate-200" : "text-slate-600"}>{plan.description}</p>
                <div className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className={`w-4 h-4 ${plan.highlighted ? "text-emerald-300" : "text-emerald-500"}`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`/register?plan=${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  className={`mt-6 inline-flex items-center justify-center w-full rounded-xl px-4 py-3 font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-white text-slate-950 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  Choose Plan
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
