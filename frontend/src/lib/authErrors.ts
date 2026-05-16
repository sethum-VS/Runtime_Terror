import type { AuthError } from "@supabase/supabase-js";

function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as AuthError).message === "string"
  );
}

/** User-facing copy for Supabase Auth API failures. */
export function formatAuthError(error: unknown): string {
  if (!isAuthError(error)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }

  const msg = error.message;
  const status = error.status;

  if (
    status === 429 ||
    /rate limit/i.test(msg) ||
    /too many requests/i.test(msg)
  ) {
    return (
      "Email sending is temporarily limited for this project. Supabase's built-in mailer allows only a few auth emails per hour (signup, reset, etc.). " +
      "Wait about an hour and try again, use Sign in if you already registered, or ask your project admin to disable “Confirm email” for local testing (Authentication → Providers → Email) or configure custom SMTP (Authentication → SMTP)."
    );
  }

  if (/already registered|already been registered|user already exists/i.test(msg)) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (/invalid login credentials/i.test(msg)) {
    return "Incorrect email or password.";
  }

  if (/email not confirmed/i.test(msg)) {
    return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
  }

  return msg;
}
