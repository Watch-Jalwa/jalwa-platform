import { reportClientError } from "./lib/observability/client";

try {
  window.addEventListener("error", (event) => {
    reportClientError({
      type: event.error instanceof Error ? event.error.name : "WindowError",
      message: event.error instanceof Error ? event.error.message : event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      mechanism: "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportClientError({
      type: reason instanceof Error ? reason.name : "UnhandledRejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      mechanism: "window.unhandledrejection",
    });
  });
} catch {
  // Monitoring must never prevent application startup.
}

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  try {
    performance.mark(`jalwa-navigation-${navigationType}-${url.slice(0, 80)}`);
  } catch {
    // Performance marks are optional evidence only.
  }
}
