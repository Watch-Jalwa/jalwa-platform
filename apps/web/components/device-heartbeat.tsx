"use client";

import { useEffect } from "react";

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return "Apple mobile browser";
  if (/Android/i.test(ua)) return "Android browser";
  if (/Windows/i.test(ua)) return "Windows browser";
  if (/Macintosh/i.test(ua)) return "Mac browser";
  return "Web browser";
}

export function DeviceHeartbeat() {
  useEffect(() => {
    let key = localStorage.getItem("jalwa_device_key");
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem("jalwa_device_key", key);
    }
    const controller = new AbortController();
    void fetch("/api/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceKey: key, displayName: deviceName(), platform: navigator.platform, userAgent: navigator.userAgent }),
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return null;
}
