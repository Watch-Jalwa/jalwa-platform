"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * After JazzCash wallet-link success, guests land on `/` with ?premium=enabled.
 * Show signup/signin so they can claim Premium with the same JazzCash number.
 * Lives in root layout — must close when leaving home (login/signup keep the layout mounted).
 */
export function PostJazzcashAuthPrompt({ signedIn = false }: { signedIn?: boolean }) {
  const titleId = useId();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const premium = searchParams.get("premium");
  const msisdn = searchParams.get("msisdn")?.trim() || "";
  const [open, setOpen] = useState(false);
  const [heldMsisdn, setHeldMsisdn] = useState("");
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error" } | null>(null);
  const onHome = pathname === "/";

  useEffect(() => {
    if (premium !== "enabled" && premium !== "failed") return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (msisdn) setHeldMsisdn(msisdn);
      if (premium === "failed") {
        setToast({
          kind: "error",
          message: "JazzCash linking did not complete. Try Subscribe Now again.",
        });
        setOpen(false);
      } else if (!signedIn) {
        setOpen(true);
        setToast(null);
      } else {
        setToast({ kind: "ok", message: "Premium features enabled" });
        setOpen(false);
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete("premium");
      params.delete("msisdn");
      const next = pathname + (params.toString() ? `?${params.toString()}` : "");
      router.replace(next, { scroll: false });
    });
    return () => {
      active = false;
    };
  }, [premium, msisdn, signedIn, pathname, router, searchParams]);

  useEffect(() => {
    if (!onHome && open) setOpen(false);
  }, [onHome, open]);

  useEffect(() => {
    if (!toast) return;
    const hide = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(hide);
  }, [toast]);

  const claimMsisdn = heldMsisdn || msisdn;
  const signupHref = claimMsisdn
    ? `/signup?next=${encodeURIComponent("/")}&prefill=${encodeURIComponent(claimMsisdn)}`
    : `/signup?next=${encodeURIComponent("/")}`;
  const loginHref = claimMsisdn
    ? `/login?next=${encodeURIComponent("/")}&prefill=${encodeURIComponent(claimMsisdn)}`
    : `/login?next=${encodeURIComponent("/")}`;

  function dismissForAuth() {
    setOpen(false);
  }

  return (
    <>
      {toast ? (
        <div
          className={`premium-status-toast${toast.kind === "error" ? " premium-status-toast-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}

      {open && onHome ? (
        <div className="unsubscribe-modal-backdrop post-jazzcash-auth-backdrop" role="presentation">
          <div
            className="unsubscribe-modal post-jazzcash-auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <span className="eyebrow">Jalwa Premium</span>
            <h2 id={titleId}>Premium is ready</h2>
            <p>
              Your JazzCash wallet is linked. Sign up or sign in with the same JazzCash mobile number to open Premium.
            </p>
            {claimMsisdn ? (
              <p className="form-message">
                Use number <strong>{claimMsisdn}</strong>
              </p>
            ) : null}
            <div className="unsubscribe-modal-actions post-jazzcash-auth-actions">
              <Link className="button button-secondary" href={signupHref} onClick={dismissForAuth}>
                Signup
              </Link>
              <Link className="button button-primary" href={loginHref} onClick={dismissForAuth}>
                Sign in
              </Link>
            </div>
            <button
              className="button button-secondary post-jazzcash-auth-dismiss"
              type="button"
              onClick={() => setOpen(false)}
            >
              Continue browsing
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
