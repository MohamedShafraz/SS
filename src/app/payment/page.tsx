"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { LOW_COST_PLANS } from "@/lib/shop-offerings";

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_38%,_#f8fafc_100%)] text-slate-900" />
      }
    >
      <PaymentContent />
    </Suspense>
  );
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get("plan") || "growth";
  const paymentStatus = searchParams.get("stripe");
  const sessionId = searchParams.get("session_id");
  const processedSessionRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stripeState, setStripeState] = useState<"idle" | "processing" | "success" | "cancelled">("idle");
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const selectedPlan = useMemo(() => {
    return (
      LOW_COST_PLANS.find((plan) => normalizeSlug(plan.name) === planSlug) ||
      LOW_COST_PLANS[1]
    );
  }, [planSlug]);

  useEffect(() => {
    if (!paymentStatus || !sessionId) {
      return;
    }

    const callbackKey = `${paymentStatus}:${sessionId}`;
    if (processedSessionRef.current === callbackKey) {
      return;
    }

    const controller = new AbortController();

    const finalize = async () => {
      setStripeState("processing");

      const endpoint =
        paymentStatus === "success"
          ? "/api/payments/stripe/complete-plan"
          : "/api/payments/stripe/cancel-plan";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to process payment status");
      }

      if (!controller.signal.aborted) {
        setStripeState(paymentStatus === "success" ? "success" : "cancelled");
        setRegisteredEmail(
          typeof result.customerEmail === "string" && result.customerEmail
            ? result.customerEmail
            : null
        );
        processedSessionRef.current = callbackKey;
      }
    };

    finalize().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Plan payment callback error:", error);
      toast.error(error instanceof Error ? error.message : "Payment status could not be processed");
      setStripeState("idle");
    });

    return () => controller.abort();
  }, [paymentStatus, sessionId]);

  const handlePay = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/payments/stripe/create-plan-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: normalizeSlug(selectedPlan.name) }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create Stripe session");
      }

      if (!result.sessionUrl) {
        throw new Error("Stripe checkout URL was not returned");
      }

      window.location.href = result.sessionUrl;
    } catch (error) {
      console.error("Plan payment error:", error);
      toast.error(error instanceof Error ? error.message : "Payment could not be started");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_38%,_#f8fafc_100%)] text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-slate-200 text-sm font-medium text-slate-700">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Secure Stripe payment
            </div>

            {stripeState === "success" || paymentStatus === "success" ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <h1 className="text-2xl font-bold text-emerald-900">Payment completed</h1>
                  </div>
                  <p className="text-emerald-800">
                    Your {selectedPlan.name} plan payment was successful. Use your account to log in, then configure your shop.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-3">Login account</p>
                    {registeredEmail ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-500">Admin email</p>
                        <p className="font-semibold text-slate-950">{registeredEmail}</p>
                        <p className="text-slate-600">Use the password you entered during registration.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-slate-500">Admin</p>
                          <p className="font-semibold text-slate-950">admin@pos.com</p>
                          <p className="text-slate-600">admin123</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Cashier</p>
                          <p className="font-semibold text-slate-950">cashier@pos.com</p>
                          <p className="text-slate-600">cashier123</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-3">Configure steps</p>
                    <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
                      <li>Go to login and sign in with the admin account.</li>
                      <li>Open Settings and set your business name, shop type, and barcode prefix.</li>
                      <li>Add your products, categories, and stock quantities.</li>
                      <li>Create cashier accounts only if you need extra staff access.</li>
                    </ol>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push("/login")}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Go to Login
                  </button>
                  {!registeredEmail && (
                    <button
                      onClick={() => router.push(`/register?plan=${normalizeSlug(selectedPlan.name)}`)}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Create Account
                    </button>
                  )}
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-4 py-3 text-slate-900 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Open Dashboard
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Go home
                  </button>
                </div>
              </div>
            ) : stripeState === "cancelled" || paymentStatus === "cancelled" ? (
              <div className="rounded-3xl bg-amber-50 border border-amber-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-amber-600" />
                  <h1 className="text-2xl font-bold text-amber-900">Payment cancelled</h1>
                </div>
                <p className="text-amber-800">
                  Your payment was cancelled. You can go back and choose another plan or try again.
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-white font-semibold hover:bg-amber-700 transition-colors"
                >
                  Go home
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-slate-950">
                    Complete your {selectedPlan.name} plan payment.
                  </h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Review the plan details, then continue to Stripe to finish the payment securely.
                  </p>
                </div>

                <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Selected plan</p>
                      <h2 className="text-2xl font-semibold text-slate-950">{selectedPlan.name}</h2>
                    </div>
                    <p className="text-3xl font-bold text-slate-950">
                      {selectedPlan.price}
                      <span className="text-sm font-medium text-slate-500">{selectedPlan.billing}</span>
                    </p>
                  </div>
                  <p className="text-slate-600">{selectedPlan.description}</p>
                  <div className="grid gap-3">
                    {selectedPlan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3 text-sm text-slate-700">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handlePay}
                    disabled={loading || stripeState === "processing"}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold hover:bg-slate-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-5 h-5" />
                    {loading || stripeState === "processing" ? "Redirecting to Stripe..." : "Pay with Stripe"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/register?plan=${normalizeSlug(selectedPlan.name)}`)}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-900 px-5 py-3 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Register and Pay
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl shadow-slate-300/40 border border-white/60 min-h-[520px]">
            <Image
              src="/Retail_shop.jpeg"
              alt="Retail shop preview"
              fill
              priority
              className="object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/65 via-slate-950/20 to-transparent" />
            <div className="absolute inset-x-6 top-6 rounded-2xl bg-white/90 backdrop-blur px-4 py-3 shadow-lg max-w-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Payment page</p>
              <p className="text-sm font-semibold text-slate-900">Choose a plan, then pay securely with Stripe.</p>
            </div>
            <div className="absolute bottom-6 left-6 right-6 grid grid-cols-1 gap-3">
              <div className="rounded-2xl bg-white/90 backdrop-blur px-4 py-4 shadow-lg">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected plan</p>
                <p className="text-lg font-semibold text-slate-950">{selectedPlan.name}</p>
                <p className="text-sm text-slate-600">{selectedPlan.price}{selectedPlan.billing}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
