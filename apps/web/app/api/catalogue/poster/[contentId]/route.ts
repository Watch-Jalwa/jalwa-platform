import { NextResponse } from "next/server";
import { isCatalogueContentId, resolveCataloguePoster } from "@/lib/catalogue/poster.mjs";
import { getProcessedObject } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opening-black FFmpeg posters from the old sampler are typically tiny JPEGs. */
const UNDERSIZED_POSTER_BYTES = 12_000;

type Params = Promise<{ contentId: string }>;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function titlePosterSvg(title: string) {
  const safe = escapeXml(title).slice(0, 72);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="${safe}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f1a16"/>
      <stop offset="55%" stop-color="#14110e"/>
      <stop offset="100%" stop-color="#2a1608"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <circle cx="540" cy="70" r="90" fill="#ff7a00" fill-opacity="0.18"/>
  <text x="36" y="64" fill="#ff7a00" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">JALWA</text>
  <foreignObject x="36" y="140" width="568" height="180">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff7ed;font:700 34px/1.15 Segoe UI, Arial, sans-serif;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${safe}</div>
  </foreignObject>
</svg>`;
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { contentId } = await params;
  if (!isCatalogueContentId(contentId)) {
    return NextResponse.json({ error: "Invalid content id." }, { status: 400 });
  }

  try {
    const poster = await resolveCataloguePoster(contentId);
    if (!poster) return NextResponse.json({ error: "Poster unavailable." }, { status: 404 });

    if (poster.kind === "redirect") {
      return NextResponse.redirect(poster.url, {
        status: 302,
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }

    const object = await getProcessedObject(poster.key);
    const body = object.Body as {
      transformToByteArray?: () => Promise<Uint8Array>;
      transformToWebStream?: () => ReadableStream<Uint8Array>;
    } | undefined;
    if (!body?.transformToByteArray && !body?.transformToWebStream) {
      return NextResponse.json({ error: "Poster body unavailable." }, { status: 503 });
    }

    // Buffer so undersized/black opening-frame JPEGs can be replaced even when ContentLength is absent.
    const bytes = body.transformToByteArray
      ? await body.transformToByteArray()
      : null;
    if (bytes && bytes.byteLength > 0 && bytes.byteLength < UNDERSIZED_POSTER_BYTES) {
      const svg = titlePosterSvg(poster.title || "Jalwa");
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
          "X-Content-Type-Options": "nosniff",
          "X-Jalwa-Poster": "title-fallback",
        },
      });
    }

    const headers = new Headers({
      "Content-Type": object.ContentType ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    });
    if (bytes) headers.set("Content-Length", String(bytes.byteLength));
    else if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());

    if (bytes) return new Response(Buffer.from(bytes), { status: 200, headers });
    return new Response(body.transformToWebStream!(), { status: 200, headers });
  } catch (error) {
    const status = typeof error === "object" && error && "$metadata" in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0)
      : 0;
    if (status === 404) return NextResponse.json({ error: "Poster not found." }, { status: 404 });
    console.error("catalogue_poster_failed", { contentId, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Poster temporarily unavailable." }, { status: 503 });
  }
}
