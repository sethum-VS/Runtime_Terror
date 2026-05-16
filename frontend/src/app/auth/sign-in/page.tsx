"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SignInPage() {
  const { signIn, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/profile");
  }, [user, isLoading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/profile");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || user) {
    return (
      <main className="pt-[200px] flex justify-center">
        <div className="glass-panel bg-surface/60 rounded-xl p-12 shimmer w-full max-w-md h-80" />
      </main>
    );
  }

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop flex justify-center">
      <div className="glass-panel bg-surface/60 rounded-xl p-8 md:p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-[48px] text-primary mb-3 block">
            login
          </span>
          <h1 className="font-headline-lg text-headline-lg text-primary">
            Welcome Back
          </h1>
          <p className="font-body-md text-on-surface-variant mt-2">
            Sign in to your VoiceTale account
          </p>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-xl px-4 py-3 mb-6 font-body-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className="font-label-md text-label-md text-on-surface-variant">
                Remember me
              </span>
            </label>
            <Link
              href="/auth/forgot-password"
              className="font-label-md text-label-md text-secondary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary rounded-full py-3 font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center font-body-md text-on-surface-variant mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/sign-up"
            className="text-secondary hover:underline font-label-md"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}
