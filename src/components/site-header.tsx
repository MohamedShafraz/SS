"use client";

import Link from "next/link";
import { SITE, validStoreUrl } from "@/site/config";
import { ExternalLinkIcon } from "@/components/icons";

export function StoreLink({ className = "" }: { className?: string }) {
  const href = validStoreUrl();
  if (!href) {
    return <span className={`${className} cursor-not-allowed opacity-60`}>Available soon</span>;
  }
  return (
    <a className={className + " text-slate-50"} href={href} target="_blank" rel="noreferrer">
      Microsoft Store <ExternalLinkIcon className="ml-1 inline-block h-4 w-4 align-[-0.15em]" />
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-900/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="MSHPOS home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500 text-sm font-black text-black/90">M</span>
          <span className="font-semibold tracking-[0.18em]">MSHPOS</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex" aria-label="Main navigation">
          <Link className="hover:text-white" href="/#features">Features</Link>
          <Link className="hover:text-white" href="/#product-tour">Product tour</Link>
          <Link className="hover:text-white" href="/#getting-started">Getting started</Link>
          <Link className="hover:text-white" href="/#online-pos">Online POS</Link>
          <Link className="hover:text-white" href="/privacy-policy">Privacy</Link>
          <StoreLink className="rounded-full bg-blue-500 px-4 py-2 font-semibold text-black/90 transition hover:bg-blue-400" />
        </nav>
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-700 px-3 py-2 text-sm">Menu</summary>
          <nav className="absolute right-0 mt-3 grid min-w-52 gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm shadow-2xl" aria-label="Mobile navigation">
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-800" href="/#features">Features</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-800" href="/#product-tour">Product tour</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-800" href="/#getting-started">Getting started</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-800" href="/#online-pos">Online POS</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-800" href="/privacy-policy">Privacy</Link>
            <StoreLink className="mt-1 rounded-lg bg-blue-500 px-3 py-2 font-semibold text-black/90" />
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 bg-black/90 text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <p className="font-semibold tracking-[0.18em] text-white">MSHPOS</p>
          <p className="mt-2 max-w-sm">Local-first retail software for independent shops and growing teams.</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <Link className="hover:text-white" href="/privacy-policy">Privacy policy</Link>
          <a className="hover:text-white" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
        </div>
      </div>
    </footer>
  );
}
