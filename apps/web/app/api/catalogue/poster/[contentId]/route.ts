import { NextResponse } from "next/server";
import { isCatalogueContentId, resolveCataloguePoster } from "@/lib/catalogue/poster.mjs";
import { getProcessedObject } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ contentId: string }>;

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
    const body = object.Body as { transformToWebStream?: () => ReadableStream<Uint8Array> } | undefined;
    if (!body?.transformToWebStream) {
      return NextResponse.json({ error: "Poster body unavailable." }, { status: 503 });
    }

    const headers = new Headers({
      "Content-Type": object.ContentType ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());

    return new Response(body.transformToWebStream(), { status: 200, headers });
  } catch (error) {
    const status = typeof error === "object" && error && "$metadata" in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0)
      : 0;
    if (status === 404) return NextResponse.json({ error: "Poster not found." }, { status: 404 });
    console.error("catalogue_poster_failed", { contentId, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Poster temporarily unavailable." }, { status: 503 });
  }
}
