"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const conversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim() || "AW-18441532429";
const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_DOWNLOAD_CONVERSION_LABEL?.trim() || "ouSOCKWWpa4dEI3ozdlE";

export function DownloadRedirect({ storeUrl }: { storeUrl: string }) {
  useEffect(() => {
    let redirected = false;

    const redirect = () => {
      if (redirected) return;
      redirected = true;
      window.location.replace(storeUrl);
    };

    const fallback = window.setTimeout(redirect, 2500);
    const startedAt = Date.now();

    const recordConversion = () => {
      if (!window.gtag) {
        if (Date.now() - startedAt < 1500) {
          window.setTimeout(recordConversion, 50);
        }
        return;
      }

      if (conversionId && conversionLabel) {
        window.gtag("event", "conversion", {
          send_to: `${conversionId}/${conversionLabel}`,
          event_callback: redirect,
          event_timeout: 1800,
        });
        return;
      }

      window.gtag("event", "download", {
        event_category: "outbound",
        event_label: "Microsoft Store",
        transport_type: "beacon",
      });
      window.setTimeout(redirect, 250);
    };

    recordConversion();

    return () => window.clearTimeout(fallback);
  }, [storeUrl]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold text-slate-950">Opening Microsoft Store…</h1>
      <p className="mt-4 text-slate-600">You will be redirected automatically.</p>
      <a className="mt-8 inline-flex rounded-full bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800" href={storeUrl}>
        Continue to Microsoft Store
      </a>
    </main>
  );
}
