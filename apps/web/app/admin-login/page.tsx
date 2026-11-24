"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(), password, callbackURL: "/studio",
      });
      if (result.error) {
        setError("Sign-in failed or this account is not authorized.");
      } else {
        window.location.assign("/studio");
      }
    } catch {
      setError("Sign-in failed. Check your credentials and try again.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="page-shell auth-journey">
    <section className="auth-intro"><span className="eyebrow">Jalwa Studio</span>
      <h1>Staff sign in</h1>
      <p>Authorized staff accounts only. Admin roles are assigned by existing Studio administrators, not by this form.</p>
    </section>
    <form className="form-shell signup-form" onSubmit={signIn}>
      <label className="form-field"><span>Staff email</span>
        <input type="email" autoComplete="username" required maxLength={254} value={email}
          onChange={event=>setEmail(event.target.value)} /></label>
      <label className="form-field"><span>Password</span>
        <input type="password" autoComplete="current-password" required value={password}
          onChange={event=>setPassword(event.target.value)} /></label>
      {error ? <p role="alert" className="policy-notice">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to Studio"}</button>
    </form>
  </main>;
}
