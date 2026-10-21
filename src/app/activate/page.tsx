"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

type SetupStatus = {
  usersCount: number;
};

export default function ActivatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState({ name: "", email: "", password: "" });

  const refreshStatus = async () => {
    const response = await fetch("/api/setup/status", { cache: "no-store" });
    const data = (await response.json()) as SetupStatus;
    setStatus(data);
    setLoading(false);
  };

  useEffect(() => {
    refreshStatus().catch(() => {
      setLoading(false);
      toast.error("Could not read setup status");
    });
  }, []);

  useEffect(() => {
    if (status && status.usersCount > 0) {
      router.replace("/login");
    }
  }, [router, status]);

  const createAdmin = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/setup/first-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not create admin");
      toast.success("Admin account created");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create admin");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking local setup
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-500">MSHPOS Offline</p>
            <h1 className="text-2xl font-bold">Create first admin</h1>
            <p className="mt-1 text-sm text-slate-600">
              Activation is disabled for now. Create the local admin account to start using the POS.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            value={admin.name}
            onChange={(event) => setAdmin((prev) => ({ ...prev, name: event.target.value }))}
            className="input-base"
            placeholder="Admin name"
          />
          <input
            value={admin.email}
            onChange={(event) => setAdmin((prev) => ({ ...prev, email: event.target.value }))}
            className="input-base"
            placeholder="Admin email"
          />
          <input
            type="password"
            value={admin.password}
            onChange={(event) => setAdmin((prev) => ({ ...prev, password: event.target.value }))}
            className="input-base"
            placeholder="Admin password"
          />
          <button
            onClick={createAdmin}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create Admin
          </button>
        </div>
      </div>
    </main>
  );
}
