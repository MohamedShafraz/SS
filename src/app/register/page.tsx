"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import { LOW_COST_PLANS } from "@/lib/shop-offerings";

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const PLAN_VISUALS: Record<string, { src: string; alt: string; label: string }> = {
  starter: {
    src: "/Retail_shop.jpeg",
    alt: "General retail shop counter",
    label: "Single shop setup",
  },
  growth: {
    src: "/Fashion_boutique.jpeg",
    alt: "Fashion boutique retail display",
    label: "Growing retail team",
  },
  "multi-shop": {
    src: "/Electronics_store.jpeg",
    alt: "Electronics store retail display",
    label: "Multi-shop operations",
  },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlanSlug = searchParams.get("plan") || "growth";
  const [planSlug, setPlanSlug] = useState(initialPlanSlug);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPlan = useMemo(() => {
    return (
      LOW_COST_PLANS.find((plan) => normalizeSlug(plan.name) === planSlug) ||
      LOW_COST_PLANS[1]
    );
  }, [planSlug]);
  const selectedPlanSlug = normalizeSlug(selectedPlan.name);
  const selectedVisual = PLAN_VISUALS[selectedPlanSlug] ?? PLAN_VISUALS.growth;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!customerName.trim() || !customerEmail.trim() || !password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/payments/stripe/create-plan-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: normalizeSlug(selectedPlan.name),
          customerName,
          customerEmail,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to start registration payment");
      }

      if (!result.sessionUrl) {
        throw new Error("Stripe checkout URL was not returned");
      }

      window.location.href = result.sessionUrl;
    } catch (error) {
      console.error("Registration payment error:", error);
      toast.error(error instanceof Error ? error.message : "Registration could not be started");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(420px,0.95fr)_minmax(0,1fr)]">
        <section className="flex min-h-screen flex-col justify-between px-4 py-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </button>
            <button
              onClick={() => router.push("/login")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Login
            </button>
          </header>

          <div className="mx-auto w-full max-w-2xl py-8">
            <div className="mb-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-500">MSPOS</p>
                  <h1 className="text-2xl font-bold text-slate-950">Create account</h1>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Set up your admin login first. After payment, this account is activated and ready to manage your shop.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <label htmlFor="plan" className="mb-2 block text-sm font-semibold text-slate-800">
                  Selected plan
                </label>
                <select
                  id="plan"
                  value={planSlug}
                  onChange={(event) => setPlanSlug(event.target.value)}
                  className="input-base"
                  disabled={loading}
                >
                  {LOW_COST_PLANS.map((plan) => (
                    <option key={plan.name} value={normalizeSlug(plan.name)}>
                      {plan.name} - {plan.price}{plan.billing}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-800">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="input-base"
                  disabled={loading}
                  autoComplete="name"
                  placeholder="Business owner name"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  className="input-base"
                  disabled={loading}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input-base"
                    disabled={loading}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-800">
                    Confirm
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="input-base"
                    disabled={loading}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {loading ? "Opening Stripe" : "Continue to payment"}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <LockKeyhole className="h-4 w-4 text-emerald-600" />
                Secure account setup
              </div>
              <button
                onClick={() => router.push("/login")}
                className="font-semibold text-blue-700 hover:text-blue-800"
              >
                Already registered?
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">© MSPOS</p>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:block">
          <Image
            key={selectedVisual.src}
            src={selectedVisual.src}
            alt={selectedVisual.alt}
            fill
            priority
            className="object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />

          <div className="absolute left-5 right-5 top-5 flex items-center justify-between text-white sm:left-8 sm:right-8 sm:top-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
              <UserPlus className="h-4 w-4" />
              {selectedVisual.label}
            </div>
            <div className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-emerald-950">
              Stripe checkout
            </div>
          </div>

          <div className="absolute bottom-6 left-5 right-5 text-white sm:bottom-8 sm:left-8 sm:right-8 lg:bottom-10 lg:left-10 lg:right-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase text-blue-200">Selected plan</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                {selectedPlan.name}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-200">
                {selectedPlan.description}
              </p>
            </div>

            <div className="mt-6 grid gap-4 rounded-lg border border-white/15 bg-white/10 p-5 backdrop-blur sm:grid-cols-[180px_1fr]">
              <div>
                <p className="text-3xl font-bold">{selectedPlan.price}</p>
                <p className="text-sm font-medium text-slate-300">{selectedPlan.billing}</p>
              </div>
              <div className="grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
                {selectedPlan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-300" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
