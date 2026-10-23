import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { SITE } from "@/site/config";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How MSHPOS handles application data and website analytics.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-slate-50 px-5 py-12 text-slate-900 sm:px-8 lg:py-20">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <p className="eyebrow">MSHPOS</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-3 text-sm text-slate-500">Effective date: October 23, 2026 · Last updated: October 23, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="policy-heading">What this policy covers</h2>
            <p>This policy covers the public MSHPOS website and the MSHPOS Windows application. It explains local application storage and the optional Google Analytics tracker used on this website.</p>
          </section>

          <section>
            <h2 className="policy-heading">Windows application data</h2>
            <p>The offline MSHPOS application stores business settings, products, stock, sales, suppliers, shops, customers, staff accounts, and backups on the Windows device. Normal POS work does not require cloud synchronisation. You control local backups and should protect or delete them when they are no longer needed.</p>
          </section>

          <section>
            <h2 className="policy-heading">Microsoft Store licence checks</h2>
            <p>Store editions ask Windows and Microsoft Store whether the installed application licence is active. Microsoft processes that request under its own privacy terms. MSHPOS does not receive your payment-card details from Microsoft Store.</p>
          </section>

          <section>
            <h2 className="policy-heading">Website analytics</h2>
            <p>Google Analytics 4 is loaded only when the site operator configures <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code>. Google may process cookie identifiers, approximate location, device and browser information, and website interactions to provide aggregated usage reports. IP anonymisation is requested in the tracker configuration. No custom visitor database, session API, CSV mailer, or analytics email service is used by this website.</p>
            <p className="mt-3">You can block analytics cookies through your browser settings or Google&apos;s available opt-out controls. The tracker is not required to read the website or contact support.</p>
          </section>

          <section>
            <h2 className="policy-heading">Requests and contact</h2>
            <p>For privacy questions or deletion requests about information you send to support, email <a className="font-medium text-blue-700 underline" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. Please do not send passwords, payment-card details, or other unnecessary sensitive information.</p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm">
          <Link className="font-semibold text-blue-700 hover:text-blue-900" href="/">← Back to MSHPOS</Link>
          <PrintButton />
        </div>
      </article>
    </main>
  );
}
