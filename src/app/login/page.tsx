"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LockKeyhole, LogIn, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, loading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.replace(user.role === "cashier" ? "/pos" : "/dashboard");
    }
  }, [authLoading, isAuthenticated, router, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login successful");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)]">
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
              onClick={() => router.push("/register")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Register
            </button>
          </header>

          <div className="mx-auto w-full max-w-md py-10">
            <div className="mb-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-500">MSPOS</p>
                  <h1 className="text-2xl font-bold text-slate-950">Sign in</h1>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Access billing, inventory, sales reports, and staff workflows from your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="input-base"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  className="input-base"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || authLoading}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading || authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loading || authLoading ? "Signing in" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <LockKeyhole className="h-4 w-4 text-emerald-600" />
                Secure session
              </div>
              <button
                onClick={() => router.push("/register")}
                className="font-semibold text-blue-700 hover:text-blue-800"
              >
                Create account
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">© MSPOS</p>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:block">
          <Image
            src="/Retail_shop.jpeg"
            alt="Retail checkout counter"
            fill
            priority
            className="object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/10" />
          <div className="absolute bottom-10 left-10 right-10 max-w-xl text-white">
            <p className="text-sm font-semibold uppercase text-blue-200">Retail control system</p>
            <h2 className="mt-3 text-4xl font-bold leading-tight">
              Keep sales, stock, and shop operations in one focused workspace.
            </h2>
          </div>
        </section>
      </div>
    </main>
  );
}
