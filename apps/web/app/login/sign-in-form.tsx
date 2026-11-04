"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Challenge = {
  challengeId: string;
  channel: "email" | "phone";
  maskedDestination: string;
  expiresAt: string;
  preview?: boolean;
};

const messages: Record<string, string> = {
  "invalid-identity": "Enter a valid email or Pakistani mobile number.",
  "invalid-email": "Enter a valid email address.",
  "invalid-phone": "Enter a valid Pakistani mobile number.",
  "invalid-name": "Enter a name between 2 and 60 characters.",
  "invalid-code": "Enter the four-digit code that was sent to you.",
  "invalid-challenge": "That code expired. Request a new one.",
  "send-failed": "The code could not be sent. Try again.",
  "method-disabled": "Phone sign-in is not enabled yet. Use an email address.",
};

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [identity, setIdentity] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function start(identityValue = identity) {
    setError(null);
    setStatus(null);
    const name = fullName.trim();
    if (name.length < 2 || name.length > 60) {
      setError(messages["invalid-name"] ?? "Enter a name between 2 and 60 characters.");
      return;
    }
    const response = await fetch("/api/v1/auth/otp/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: identityValue }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messages[String(payload.error ?? "")] ?? "The code could not be sent. Try again.");
      return;
    }
    setChallenge(payload as Challenge);
    setCode("");
    setStatus(
      payload.preview
        ? "Preview complete: production sends a four-digit code."
        : `Enter the four-digit code sent to ${payload.maskedDestination}.`,
    );
  }

  async function verify() {
    if (!challenge) return;
    setError(null);
    const response = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        code,
        displayName: fullName.trim(),
        next,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messages[String(payload.error ?? "")] ?? "That code could not be verified.");
      return;
    }
    startTransition(() => {
      router.replace(typeof payload.next === "string" ? payload.next : next);
      router.refresh();
    });
  }

  if (challenge) {
    return (
      <form
        className="form-shell signup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <h2>Enter your code</h2>
        <p className="form-message">Code expires shortly and stops working after five unsuccessful attempts.</p>
        <label className="form-field">
          <span>Four-digit code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <p className={error ? "form-message" : "form-success"} role="status">{error ?? status ?? ""}</p>
        <button className="button button-primary" type="submit" disabled={pending || code.length !== 4}>
          Verify and continue
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={pending}
          onClick={() => void start(identity)}
        >
          Resend code
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            setChallenge(null);
            setCode("");
            setError(null);
            setStatus(null);
          }}
        >
          Use a different email or number
        </button>
      </form>
    );
  }

  return (
    <form
      className="form-shell signup-form"
      onSubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <h2>Sign in or create account</h2>
      <label className="form-field">
        <span>Full name</span>
        <input
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={60}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Email or mobile number</span>
        <input
          name="identity"
          autoComplete="username"
          required
          maxLength={254}
          placeholder="0300 1234567 or you@example.com"
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
        />
      </label>
      <p className="form-message">Pakistan mobile formats such as 0300 1234567 and +923001234567 are accepted.</p>
      <p className="form-message" role="status">{error ?? ""}</p>
      <button className="button button-primary" type="submit" disabled={pending}>Continue</button>
    </form>
  );
}
