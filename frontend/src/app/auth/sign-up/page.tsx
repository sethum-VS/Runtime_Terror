"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatAuthError } from "@/lib/authErrors";

export default function SignUpPage() {
  const { signUp, user, isLoading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/profile");
  }, [user, isLoading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the terms");
      return;
    }

    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp(
        email,
        password,
        fullName
      );
      if (needsEmailConfirmation) {
        setSuccess(
          `We sent a confirmation link to ${email}. Open it to activate your account, then sign in.`
        );
        return;
      }
      router.push("/profile");
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || user) {
    return (
      <main className="pt-[200px] flex justify-center">
        <div className="glass-panel bg-surface/60 rounded-xl p-12 shimmer w-full max-w-md h-96" />
      </main>
    );
  }

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop flex justify-center">
      <div className="glass-panel bg-surface/60 rounded-xl p-8 md:p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-[48px] text-primary mb-3 block">
            person_add
          </span>
          <h1 className="font-headline-lg text-headline-lg text-primary">
            Create Account
          </h1>
          <p className="font-body-md text-on-surface-variant mt-2">
            Join VoiceTale and start listening
          </p>
        </div>

        {success && (
          <div className="bg-secondary-container text-on-secondary-container rounded-xl px-4 py-3 mb-6 font-body-md">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-error-container text-on-error-container rounded-xl px-4 py-3 mb-6 font-body-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Jane Doe"
            />
          </div>
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
          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <span className="font-label-md text-label-md text-on-surface-variant">
              I agree to the Terms of Service
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary rounded-full py-3 font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center font-body-md text-on-surface-variant mt-6">
          Already have an account?{" "}
          <Link
            href="/auth/sign-in"
            className="text-secondary hover:underline font-label-md"
          >
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
