import { handleJazzcashIpn } from "./jazzcash-landing-billing.mjs";

/**
 * Parse JazzCash IPN / return-style payloads (form, JSON, or query).
 * @param {Request} request
 */
export async function readJazzcashNotifyFields(request) {
  const url = new URL(request.url);
  /** @type {Record<string, string>} */
  const fields = {};

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") fields[key] = value;
      }
    } else {
      const json = await request.json().catch(() => ({}));
      if (json && typeof json === "object" && !Array.isArray(json)) {
        for (const [key, value] of Object.entries(json)) {
          if (typeof value === "string") fields[key] = value;
        }
      }
    }
  }

  for (const [key, value] of url.searchParams.entries()) {
    if (!(key in fields)) fields[key] = value;
  }

  return fields;
}

/**
 * Shared IPN response. JazzCash expects a simple HTTP ACK; JSON available via Accept.
 * @param {Request} request
 */
export async function respondToJazzcashIpn(request) {
  const fields = await readJazzcashNotifyFields(request);
  const result = await handleJazzcashIpn(fields);
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return Response.json(result.body, {
      status: result.httpStatus,
      headers: { "cache-control": "no-store" },
    });
  }
  return new Response("OK", {
    status: result.httpStatus,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
