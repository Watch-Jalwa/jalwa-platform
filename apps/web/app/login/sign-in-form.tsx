"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readLandingMsisdn } from "@/lib/utm-attribution.mjs";

const messages: Record<string, string> = {
  "invalid-phone": "Enter a valid Pakistani mobile number.",
  "invalid-password": "Password must be 7–128 characters and include upper, lower, digit and symbol.",
  "invalid-name": "Enter your full name to create an account.",
  "invalid-credentials": "Mobile number or password is incorrect.",
  "password-mismatch": "Passwords do not match.",
};

function subscribeToLandingIdentity(change: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", change);
  return () => window.removeEventListener("storage", change);
}

function serverLandingIdentity() {
  return "";
}

export function SignInForm({
  next,
  prefillIdentity = "",
  mode = "signin",
}: {
  next: string;
  prefillIdentity?: string;
  mode?: "signin" | "signup";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isSignup = mode === "signup";
  const [fullName, setFullName] = useState("");
  const storedLandingIdentity = useSyncExternalStore(subscribeToLandingIdentity, readLandingMsisdn, serverLandingIdentity);
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const phone = phoneOverride ?? (prefillIdentity || storedLandingIdentity);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (isSignup && password !== confirmPassword) {
      setError(messages["password-mismatch"]);
      return;
    }

    const response = await fetch("/api/v1/auth/password/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        displayName: isSignup ? fullName.trim() : undefined,
        phone,
        password,
        next,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messages[String(payload.error ?? "")] ?? payload.message ?? "Sign-in failed.");
      return;
    }
    startTransition(() => {
      router.replace(typeof payload.next === "string" ? payload.next : next);
      router.refresh();
    });
  }

  const switchHref = isSignup
    ? `/login?mode=signin&next=${encodeURIComponent(next)}${phone ? `&prefill=${encodeURIComponent(phone)}` : ""}`
    : `/signup?next=${encodeURIComponent(next)}${phone ? `&prefill=${encodeURIComponent(phone)}` : ""}`;

  return (
    <form
      className="form-shell signup-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2>{isSignup ? "Create your Jalwa account" : "Sign in"}</h2>
      <p className="form-message">
        {isSignup
          ? "Use your JazzCash mobile number. After pay-first checkout, the same number unlocks Premium."
          : "Sign in with the same JazzCash mobile number you used at checkout."}
      </p>

      {isSignup ? (
        <label className="form-field">
          <span>Full name</span>
          <input
            name="displayName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={60}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
      ) : null}

      <label className="form-field">
        <span>Mobile number</span>
        <input
          name="phone"
          autoComplete="tel"
          inputMode="numeric"
          required
          maxLength={20}
          placeholder="03001234567"
          value={phone}
          onChange={(event) => setPhoneOverride(event.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={7}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {isSignup ? (
        <label className="form-field">
          <span>Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={7}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
      ) : null}

      {isSignup ? (
        <p className="form-message">Password needs upper, lower, digit and symbol (for example Abc@123).</p>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
      </button>

      <p className="auth-switch">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href={switchHref}>Click here to sign in</Link>
          </>
        ) : (
          <>
            New to Jalwa?{" "}
            <Link href={switchHref}>Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
