import Script from "next/script";
import { headers } from "next/headers";

function measurementId() {
  const value = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return value && /^G-[A-Z0-9]+$/i.test(value) ? value : null;
}

export async function GoogleAnalytics() {
  const id = measurementId();
  if (!id) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
