"use client";

import { useEffect } from "react";

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify({ ...payload, path: window.location.pathname, version: document.documentElement.dataset.release ?? "unknown" });
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon("/api/observability/client-error", blob)) {
    void fetch("/api/observability/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" });
  }
}

export function ErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => send({ type: "error", message: event.message, filename: event.filename, line: event.lineno, column: event.colno, stack: event.error instanceof Error ? event.error.stack : undefined });
    const onRejection = (event: PromiseRejectionEvent) => send({ type: "unhandled_rejection", message: event.reason instanceof Error ? event.reason.message : String(event.reason), stack: event.reason instanceof Error ? event.reason.stack : undefined });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
