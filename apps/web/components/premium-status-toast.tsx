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
    const next = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(next, { scroll: false });
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
