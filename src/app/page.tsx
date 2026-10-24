import Image from "next/image";
import { FEATURES, INDUSTRIES, onlinePosHref } from "@/site/config";
import { ProductTour } from "@/components/product-tour";
import { StoreLink } from "@/components/site-header";

const steps = ["Open the Microsoft Store listing", "Install MSHPOS on Windows", "Create your business and first administrator", "Add products and configure settings", "Start selling with your local POS"];

export default function Home() {
  return (
    <main>
      <section className="overflow-hidden bg-slate-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">MSHPOS / retail software</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">A calmer counter for busy independent shops.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">MSHPOS is a focused offline Windows point-of-sale system for checkout, products, stock, receipts, returns, and the reporting that keeps a shop moving.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <StoreLink className="rounded-full bg-blue-500 px-5 py-3 font-semibold text-black/90 transition hover:bg-blue-400" />
              <a className="rounded-full border border-slate-600 px-5 py-3 font-semibold hover:border-white" href={onlinePosHref()}>Request online POS</a>
            </div>
            <p className="mt-5 text-sm text-slate-400">The Windows edition keeps normal POS work on the device. Microsoft Store handles purchase and installation.</p>
          </div>
          <div className="relative rounded-[2rem] border border-slate-700 bg-slate-900 p-3 shadow-2xl">
            <Image className="h-auto w-full rounded-[1.5rem]" src="/store-assets/mshpos-super-hero-blue.png" alt="MSHPOS dashboard showing sales and inventory overview" width={1672} height={941} priority />
            <div className="absolute -bottom-5 -left-4 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm shadow-xl"><span className="text-blue-300">Local-first</span><br /><span className="text-slate-300">Designed for the shop floor</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24" id="product-options">
        <div className="max-w-2xl"><p className="eyebrow">Choose your path</p><h2 className="section-title">One product idea, two ways to work.</h2></div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="rounded-3xl bg-slate-900 p-7 text-white"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Offline Windows POS</p><h3 className="mt-4 text-3xl font-semibold">Keep the counter dependable.</h3><p className="mt-4 leading-7 text-slate-300">Buy MSHPOS through Microsoft Store, set up your business locally, and keep everyday selling available without cloud synchronization.</p><div className="mt-7"><StoreLink className="rounded-full bg-blue-500 px-5 py-3 font-semibold text-black/90 hover:bg-blue-400" /></div></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-7"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Custom online POS</p><h3 className="mt-4 text-3xl font-semibold text-slate-950">Need a hosted workflow?</h3><p className="mt-4 leading-7 text-slate-600">Tell us about your business, branches, and team. We can discuss a custom hosted POS setup and the right operating model for you.</p><div className="mt-7"><a className="inline-flex rounded-full bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800" href={onlinePosHref()}>Start an enquiry</a></div></article>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white" id="features">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24"><p className="eyebrow">Built around the counter</p><h2 className="section-title max-w-2xl">The details that make daily selling easier.</h2><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map((feature, index) => <article className="rounded-2xl border border-slate-200 p-5" key={feature.title}><span className="text-sm font-semibold text-blue-700">0{index + 1}</span><h3 className="mt-8 text-lg font-semibold text-slate-950">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p></article>)}</div></div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24" id="industries"><div className="max-w-2xl"><p className="eyebrow">Made to adapt</p><h2 className="section-title">Start with the way your shop already works.</h2></div><div className="mt-10 grid gap-5 sm:grid-cols-2">{INDUSTRIES.map((industry) => <article className="group overflow-hidden rounded-3xl bg-slate-900 text-white" key={industry.name}><Image className="h-52 w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" src={industry.image} alt={`${industry.name} shop`} width={900} height={600} /><div className="p-6"><h3 className="text-xl font-semibold">{industry.name}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{industry.text}</p></div></article>)}</div></section>

      <ProductTour />

      <section className="bg-slate-900 text-white" id="getting-started"><div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="eyebrow text-blue-300">Getting started</p><h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 sm:text-4xl">From Store listing to first sale, one clear setup.</h2></div><ol className="mt-10 grid gap-4 md:grid-cols-5">{steps.map((step, index) => <li className="rounded-2xl border border-blue-800 bg-blue-900/60 p-5" key={step}><span className="text-3xl font-semibold text-blue-300">0{index + 1}</span><p className="mt-8 text-sm font-medium leading-6 text-blue-50">{step}</p></li>)}</ol><div className="mt-10"><StoreLink className="rounded-full bg-blue-500 px-5 py-3 font-semibold text-black/90 hover:bg-blue-400" /></div></div></section>

      <section className="border-t border-slate-200 bg-white" id="online-pos"><div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24"><p className="eyebrow">Online POS enquiry</p><h2 className="section-title max-w-2xl">Tell us what your hosted operation needs.</h2><p className="mt-5 max-w-2xl leading-7 text-slate-600">Share your shop type, number of locations, and the workflow you want to improve. We will reply by email to discuss a custom online POS option.</p><a className="mt-7 inline-flex rounded-full bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800" href={onlinePosHref()}>Email an enquiry</a><p className="mt-4 text-sm text-slate-500">No account or visitor form is created by this website.</p></div></section>
    </main>
  );
}
