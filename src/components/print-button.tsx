"use client";

export function PrintButton() {
  return <button className="font-semibold text-slate-600 hover:text-slate-950" type="button" onClick={() => window.print()}>Print policy</button>;
}
