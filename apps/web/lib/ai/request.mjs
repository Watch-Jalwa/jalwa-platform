export class AiRequestBodyError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AiRequestBodyError";
    this.status = status;
  }
}

export async function readAiRequestBody(request, maxBytes = 16_384) {
  if (!(request instanceof Request)) {
    throw new TypeError("request must be a Request");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new AiRequestBodyError("Request body is too large.", 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    throw new AiRequestBodyError("Request body is too large.", 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AiRequestBodyError("Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AiRequestBodyError("Request body must be a JSON object.", 400);
  }

  return body;
}
