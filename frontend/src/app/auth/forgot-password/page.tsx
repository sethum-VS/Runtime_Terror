"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPassword, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/profile");
  }, [user, isLoading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || user) {
    return (
      <main className="pt-[200px] flex justify-center">
        <div className="glass-panel bg-surface/60 rounded-xl p-12 shimmer w-full max-w-md h-64" />
      </main>
    );
  }

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop flex justify-center">
      <div className="glass-panel bg-surface/60 rounded-xl p-8 md:p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-[48px] text-primary mb-3 block">
            lock_reset
          </span>
          <h1 className="font-headline-lg text-headline-lg text-primary">
            Reset Password
          </h1>
          <p className="font-body-md text-on-surface-variant mt-2">
            Enter your email to receive a reset link
          </p>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-xl px-4 py-3 mb-6 font-body-md">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-primary-container text-on-primary-container rounded-xl px-4 py-6 text-center">
            <span className="material-symbols-outlined text-[32px] mb-2 block">
              mark_email_read
            </span>
            <p className="font-body-md">
              Check your email for a password reset link.
            </p>
            <Link
              href="/auth/sign-in"
              className="inline-block mt-4 text-secondary hover:underline font-label-md text-label-md"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-on-primary rounded-full py-3 font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        {!success && (
          <p className="text-center font-body-md text-on-surface-variant mt-6">
            Remember your password?{" "}
            <Link
              href="/auth/sign-in"
              className="text-secondary hover:underline font-label-md"
            >
              Sign In
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
