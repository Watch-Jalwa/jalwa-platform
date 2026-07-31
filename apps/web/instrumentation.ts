import { emitObservabilityEvent } from "@/lib/observability/event";

export function register() {
  process.on("uncaughtException", (error) => {
    emitObservabilityEvent({ level: "fatal", event: "web.uncaught_exception", error });
  });
  process.on("unhandledRejection", (reason) => {
    emitObservabilityEvent({ level: "fatal", event: "web.unhandled_rejection", error: reason });
  });
}

export const onRequestError = async (
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string },
) => {
  const requestIdHeader = request.headers["x-request-id"];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
  emitObservabilityEvent({
    level: "error",
    event: "web.request_error",
    requestId,
    error,
    context: {
      method: request.method,
      path: request.path.split("?")[0],
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
};
