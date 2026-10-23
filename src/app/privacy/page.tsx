export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-slate-500">MSHPOS</p>
        <h1 className="mt-1 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: October 21, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <section><h2 className="text-lg font-semibold text-slate-950">Local data</h2><p>MSHPOS stores business settings, products, stock, sales, suppliers, shops, customers, and staff accounts locally on the Windows device. MSHPOS does not use Supabase or cloud synchronization.</p></section>
          <section><h2 className="text-lg font-semibold text-slate-950">Microsoft Store licence</h2><p>The app asks Windows and Microsoft Store whether the installed app licence is active. Microsoft processes that request under its own privacy terms. MSHPOS does not receive payment-card details.</p></section>
          <section><h2 className="text-lg font-semibold text-slate-950">Backups</h2><p>Administrators may create backups or select a local backup folder. Those files can contain business and personal information and remain under the customer&apos;s control. Administrators are responsible for securing and deleting backup files when no longer required.</p></section>
          <section><h2 className="text-lg font-semibold text-slate-950">Retention and deletion</h2><p>Local records remain until an authorized user deletes them, restores another backup, or removes the application data. Uninstalling the app may remove local data, so customers should export a backup first.</p></section>
          <section><h2 className="text-lg font-semibold text-slate-950">Support</h2><p>Privacy and support questions may be sent to <a className="font-medium underline" href="mailto:mshpos@proton.me">mshpos@proton.me</a>.</p></section>
        </div>
      </article>
    </main>
  );
}
