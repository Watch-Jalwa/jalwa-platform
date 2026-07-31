export interface Env { MEDIA_BUCKET: R2Bucket; MEDIA_SIGNING_SECRET: string; MEDIA_GATEWAY_ALLOWED_ORIGINS?: string; ALLOWED_ORIGINS?: string; }

function fromBase64Url(value: string) { value = value.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function verify(token: string, secret: string) { const [body, signature] = token.split("."); if (!body || !signature) return null; const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(body)); if (!valid) return null; const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as { exp?: number; pathPrefix?: string }; return payload.exp && payload.exp >= Math.floor(Date.now() / 1000) ? payload : null; }

function cors(request: Request, env: Env) {
  const origin = request.headers.get("origin");
  const configured = env.MEDIA_GATEWAY_ALLOWED_ORIGINS ?? env.ALLOWED_ORIGINS ?? "https://watch-jalwa.com,https://www.watch-jalwa.com";
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  const headers = new Headers({ vary: "Origin" });
  if (origin && allowed.includes(origin)) headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET,HEAD,OPTIONS");
  headers.set("access-control-allow-headers", "Range,Content-Type");
  headers.set("access-control-expose-headers", "Content-Length,Content-Range,Accept-Ranges,ETag");
  return headers;
}

function withToken(uri: string, token: string) {
  if (!uri || uri.startsWith("skd:") || uri.startsWith("data:") || uri.startsWith("blob:")) return uri;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}token=${encodeURIComponent(token)}`;
}

function rewritePlaylist(text: string, token: string) {
  return text.split(/\r?\n/).map((line) => {
    if (!line) return line;
    if (!line.startsWith("#")) return withToken(line, token);
    return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${withToken(uri, token)}"`);
  }).join("\n");
}

export default {
  async fetch(request: Request, env: Env) {
    const corsHeaders = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const payload = token ? await verify(token, env.MEDIA_SIGNING_SECRET).catch(() => null) : null;
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!payload?.pathPrefix || !key.startsWith(payload.pathPrefix)) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const object = await env.MEDIA_BUCKET.get(key, { range: request.headers });
    if (!object) return new Response("Not found", { status: 404, headers: corsHeaders });
    const headers = new Headers(corsHeaders);
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", key.endsWith(".m3u8") ? "private, max-age=30" : "private, max-age=300");
    headers.set("accept-ranges", "bytes");
    if (request.method === "HEAD") return new Response(null, { status: 200, headers });
    if (key.endsWith(".m3u8") && token) {
      const playlist = rewritePlaylist(await object.text(), token);
      headers.set("content-type", "application/vnd.apple.mpegurl");
      headers.set("content-length", String(new TextEncoder().encode(playlist).byteLength));
      return new Response(playlist, { status: 200, headers });
    }
    return new Response(object.body, { status: object.range ? 206 : 200, headers });
  },
};
