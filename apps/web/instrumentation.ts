import type { Instrumentation } from "next";

function normalizeRequestError(input: unknown) {
  if (input instanceof Error) {
    return input as Error & { digest?: string };
  }
  const normalized = new Error(typeof input === "string" ? input : "Unknown request error") as Error & { digest?: string };
  if (input && typeof input === "object" && "digest" in input && typeof input.digest === "string") {
    normalized.digest = input.digest;
  }
  return normalized;
}

export const onRequestError: Instrumentation.onRequestError = async (input, request, context) => {
  const error = normalizeRequestError(input);
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error(JSON.stringify({
      event: "edge_request_error",
      release: process.env.GIT_SHA || "local",
      route: context.routePath,
      method: request.method,
      digest: error.digest,
      message: error.message.slice(0, 2000),
    }));
    return;
  }

  const { reportServerError } = await import("./lib/observability/server");
  await reportServerError(error, {
    mechanism: "nextjs.onRequestError",
    route: context.routePath || request.path.split("?")[0],
    method: request.method,
    routeType: context.routeType,
    routerKind: context.routerKind,
    digest: error.digest,
    tags: {
      render_source: context.renderSource,
      revalidate_reason: context.revalidateReason,
    },
  });
};
