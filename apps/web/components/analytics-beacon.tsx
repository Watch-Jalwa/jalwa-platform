"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function sessionId() {
  const existing = sessionStorage.getItem("jalwa_session_id");
  if (existing) return existing;
  const value = crypto.randomUUID().replaceAll("-", "");
  sessionStorage.setItem("jalwa_session_id", value);
  return value;
}

export function trackEvent(eventName: string, input: { path?: string; contentId?: string; properties?: Record<string, unknown> } = {}) {
  if (typeof window === "undefined" || navigator.globalPrivacyControl) return;
  const payload = JSON.stringify({ eventName, path: input.path ?? window.location.pathname, contentId: input.contentId, properties: input.properties ?? {}, sessionId: sessionId() });
  const blob = new Blob([payload], { type: "application/json" });
  if (!navigator.sendBeacon("/api/analytics", blob)) {
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
  }
}

export function AnalyticsBeacon() {
  const pathname = usePathname();
  useEffect(() => { trackEvent("page_view", { path: pathname }); }, [pathname]);
  return null;
}
