import { liveSourcesEnabled, getLiveSourceDefinition } from "@/lib/live-sources/registry";
import { resolveLiveImage } from "@/lib/live-sources/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ sourceKey: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  if (!liveSourcesEnabled()) return new Response("Not found", { status: 404 });
  const { sourceKey } = await params;
  const definition = getLiveSourceDefinition(sourceKey);
  if (!definition || definition.adapter !== "public_domain_live_image") return new Response("Not found", { status: 404 });

  try {
    const image = await resolveLiveImage(sourceKey);
    const incomingEtag = request.headers.get("if-none-match");
    const etag = image.etag ?? `"${image.contentHash}"`;
    const cacheSeconds = Math.max(60, Math.min(definition.refreshIntervalSeconds, 3600));
    const headers = new Headers({
      "cache-control": `public, max-age=30, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      "content-type": image.contentType,
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "same-origin",
      etag,
      "x-content-type-options": "nosniff",
      "x-jalwa-live-source": sourceKey,
      "x-jalwa-upstream-source": new URL(image.sourceUrl).hostname,
    });
    if (image.lastModified) headers.set("last-modified", image.lastModified);
    if (incomingEtag && incomingEtag === etag) return new Response(null, { status: 304, headers });
    return new Response(Buffer.from(image.bytes), { status: 200, headers });
  } catch (error) {
    console.error("public_domain_live_image_failed", { sourceKey, error });
    return Response.json({ error: "Official live image temporarily unavailable." }, {
      status: 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
}
