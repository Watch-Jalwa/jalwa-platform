import { NextResponse } from "next/server";
import { getProcessedObject } from "@/lib/media/storage";
import { mediaPathAllowed, normalizeMediaPath, rewriteHlsPlaylist } from "@/lib/media/gateway.mjs";
import { verifyPlaybackToken } from "@/lib/media/token.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ path: string[] }>;

type StreamingBody = {
  transformToString?: () => Promise<string>;
  transformToWebStream?: () => ReadableStream<Uint8Array>;
};

function responseHeaders(object: Awaited<ReturnType<typeof getProcessedObject>>, playlist: boolean) {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": playlist ? "private, no-store" : "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  if (object.ContentType) headers.set("Content-Type", object.ContentType);
  if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
  if (object.ContentRange) headers.set("Content-Range", object.ContentRange);
  if (object.ETag) headers.set("ETag", object.ETag);
  if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());
  return headers;
}

async function serve(request: Request, params: Params, headOnly: boolean) {
  if ((process.env.MEDIA_BACKEND ?? "r2").trim().toLowerCase() !== "r2") {
    return NextResponse.json({ error: "R2 media delivery is not active." }, { status: 404 });
  }

  const { path } = await params;
  const key = normalizeMediaPath(path);
  if (!key) return NextResponse.json({ error: "Invalid media path." }, { status: 400 });

  const token = new URL(request.url).searchParams.get("token");
  const payload = verifyPlaybackToken(token ?? "", process.env.MEDIA_SIGNING_SECRET ?? "");
  const pathPrefix = typeof payload?.pathPrefix === "string" ? payload.pathPrefix : "";
  if (!payload || !mediaPathAllowed(key, pathPrefix)) {
    return NextResponse.json({ error: "Playback token is invalid or expired." }, { status: 403 });
  }

  const playlist = key.endsWith(".m3u8");
  const range = playlist ? null : request.headers.get("range");

  try {
    const object = await getProcessedObject(key, range);
    const headers = responseHeaders(object, playlist);
    const body = object.Body as StreamingBody | undefined;

    if (playlist && !headOnly) {
      if (!body?.transformToString) throw new Error("R2 playlist body is not readable.");
      const rewritten = rewriteHlsPlaylist(await body.transformToString(), token ?? "");
      headers.delete("Content-Length");
      headers.set("Content-Type", "application/vnd.apple.mpegurl");
      return new Response(rewritten, { status: 200, headers });
    }

    if (headOnly) return new Response(null, { status: object.ContentRange ? 206 : 200, headers });
    if (!body?.transformToWebStream) throw new Error("R2 media body is not streamable.");
    return new Response(body.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers });
  } catch (error) {
    const status = typeof error === "object" && error && "$metadata" in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0)
      : 0;
    if (status === 404) return NextResponse.json({ error: "Media object not found." }, { status: 404 });
    console.error("media gateway failure", { key, status: status || undefined });
    return NextResponse.json({ error: "Media is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request, { params }: { params: Params }) {
  return serve(request, params, false);
}

export async function HEAD(request: Request, { params }: { params: Params }) {
  return serve(request, params, true);
}
