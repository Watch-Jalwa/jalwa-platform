"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe=()=>()=>{};
const clientReady=()=>true;
const serverReady=()=>false;

export default function AdminLoginPage() {
  const ready=useSyncExternalStore(subscribe,clientReady,serverReady);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    const fields=new FormData(event.currentTarget);
    const email=String(fields.get("email")??"").trim().toLowerCase();
    const password=String(fields.get("password")??"");
    if(!email || !password){setError("Enter your staff email and password.");return;}
    setBusy(true); setError("");
    try {
      // Use Better Auth's existing server-side credential validation directly,
      // then force a fresh request so the Studio guard sees the new session cookie.
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, password, callbackURL: "/studio" }),
      });
      if (!response.ok) {
        setError("Sign-in failed or this account is not authorized.");
      } else {
        window.location.replace("/studio");
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
    <form className="form-shell signup-form" method="post" onSubmit={signIn}>
      <label className="form-field"><span>Staff email</span>
        <input name="email" type="email" autoComplete="username" required maxLength={254} disabled={!ready} /></label>
      <label className="form-field"><span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required disabled={!ready} /></label>
      {error ? <p role="alert" className="policy-notice">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={busy || !ready}>{busy ? "Signing in…" : "Sign in to Studio"}</button>
    </form>
  </main>;
}
