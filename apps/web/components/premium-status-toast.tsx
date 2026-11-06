"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TOAST_MS = 5500;

export function PremiumStatusToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = searchParams.get("premium");
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error" } | null>(null);

  useEffect(() => {
    if (status !== "enabled" && status !== "failed") return;
    // Queue the notification after the effect: avoid a synchronous render cascade.
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setToast({
        kind: status === "enabled" ? "ok" : "error",
        message:
          status === "enabled"
            ? "Premium features enabled"
            : "JazzCash linking did not complete. Try Subscribe Now again.",
      });
      const params = new URLSearchParams(searchParams.toString());
      params.delete("premium");
      params.delete("msisdn");
      const next = pathname + (params.toString() ? "?" + params.toString() : "");
      router.replace(next, { scroll: false });
    });
    return () => { active = false; };
  }, [status, pathname, router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const hide = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(hide);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={`premium-status-toast${toast.kind === "error" ? " premium-status-toast-error" : ""}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
