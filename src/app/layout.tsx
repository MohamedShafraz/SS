import type { Metadata } from "next";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import "./globals.css";

function metadataBase() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    return new URL(value);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  title: { default: "MSHPOS | Point of sale for independent shops", template: "%s | MSHPOS" },
  description: "A focused offline Windows point-of-sale system for independent retailers and growing shops.",
  metadataBase: metadataBase(),
  openGraph: { title: "MSHPOS", description: "A focused point-of-sale system for independent shops.", images: ["/store-assets/mshpos-super-hero-blue.png"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
