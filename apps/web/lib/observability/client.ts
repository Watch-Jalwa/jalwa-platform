type ClientErrorInput = {
  type?: string;
  message: string;
  stack?: string;
  digest?: string;
  mechanism?: string;
};

function clean(value: unknown, maximum: number) {
  return String(value ?? "")
    .slice(0, maximum)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/((?:password|secret|token|api[_-]?key|session|signature)["'=:\s]+)([^\s,;"']+)/gi, "$1[REDACTED]");
}

export function reportClientError(input: ClientErrorInput) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    type: clean(input.type || "Error", 100),
    message: clean(input.message, 2000),
    stack: clean(input.stack, 10000),
    digest: clean(input.digest, 200),
    mechanism: clean(input.mechanism || "browser", 100),
    path: window.location.pathname.slice(0, 500),
  });
  if (payload.length > 14000) return;
  const blob = new Blob([payload], { type: "application/json" });
  if (!navigator.sendBeacon("/api/observability/errors", blob)) {
    void fetch("/api/observability/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }
}
