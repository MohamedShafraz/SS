import Script from "next/script";
import { headers } from "next/headers";

function measurementId() {
  const value = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return value && /^G-[A-Z0-9]+$/i.test(value) ? value : null;
}

function adsId() {
  const value = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim() || "AW-18441532429";
  return value && /^AW-\d+$/i.test(value) ? value : null;
}

export async function GoogleAnalytics() {
  const analyticsId = measurementId();
  const googleAdsId = adsId();
  const scriptId = analyticsId ?? googleAdsId;
  if (!scriptId) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const configurations = [analyticsId, googleAdsId]
    .filter((id): id is string => Boolean(id))
    .map((id) => `gtag('config', '${id}', { anonymize_ip: true });`)
    .join("\n");

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(scriptId)}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
${configurations}`}
      </Script>
    </>
  );
}
