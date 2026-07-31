import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
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
      render_type: context.renderType,
      revalidate_reason: context.revalidateReason,
    },
  });
};
