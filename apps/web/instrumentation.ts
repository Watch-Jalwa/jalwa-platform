import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { emitObservabilityEvent } = await import("@/lib/observability/event");

  process.on("uncaughtException", (error) => {
    emitObservabilityEvent({ level: "fatal", event: "web.uncaught_exception", error });
  });
  process.on("unhandledRejection", (reason) => {
    emitObservabilityEvent({ level: "fatal", event: "web.unhandled_rejection", error: reason });
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestIdHeader = request.headers["x-request-id"];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
  const safeContext = {
    method: request.method,
    path: request.path.split("?")[0],
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  };

  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "jalwa-web",
      version: process.env.GIT_SHA ?? "local",
      environment: process.env.NODE_ENV ?? "development",
      level: "error",
      event: "web.edge_request_error",
      requestId,
      error: error instanceof Error ? { name: error.name, message: error.message.slice(0, 1000) } : "request failed",
      context: safeContext,
    }));
    return;
  }

  const { emitObservabilityEvent } = await import("@/lib/observability/event");
  emitObservabilityEvent({
    level: "error",
    event: "web.request_error",
    requestId,
    error,
    context: safeContext,
  });
};
