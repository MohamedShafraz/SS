import type { Metadata } from "next";

import { DownloadRedirect } from "@/components/download-redirect";
import { validStoreUrl } from "@/site/config";

export const metadata: Metadata = {
  title: "Opening Microsoft Store",
  robots: { index: false, follow: false },
};

export default function DownloadPage() {
  const storeUrl = validStoreUrl();

  if (!storeUrl) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-3xl font-semibold text-slate-950">Download unavailable</h1>
        <p className="mt-4 text-slate-600">The Microsoft Store link is not configured.</p>
      </main>
    );
  }

  return <DownloadRedirect storeUrl={storeUrl} />;
}
