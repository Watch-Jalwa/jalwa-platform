import { NextResponse } from "next/server";
import { buildGeneratedPosterSvg, isCatalogueContentId, resolveCataloguePoster } from "@/lib/catalogue/poster.mjs";

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

    const svg = buildGeneratedPosterSvg({
      id: poster.id || contentId,
      slug: poster.slug,
      title: poster.title || "Jalwa",
      category: poster.category,
      contentType: poster.contentType,
      durationSeconds: poster.durationSeconds,
    });

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Jalwa-Poster": "generated",
      },
    });
  } catch (error) {
    console.error("catalogue_poster_failed", { contentId, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Poster temporarily unavailable." }, { status: 503 });
  }
}
