import { NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/media/storage";
import { getStaffApiContext } from "@/lib/media/staff-api";
import { safeMediaExtension, selectPipeline, validateMediaUpload } from "@/lib/media/policy.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await getStaffApiContext();
  if ("error" in context) return context.error;

  const body = await request.json().catch(() => null) as null | {
    contentId?: string; filename?: string; mimeType?: string; sizeBytes?: number; durationSeconds?: number | null;
  };
  if (!body?.contentId || !body.filename || !body.mimeType || !body.sizeBytes) {
    return NextResponse.json({ error: "Missing upload fields." }, { status: 400 });
  }

  const validation = validateMediaUpload({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const { data: content } = await context.supabase
    .from("content_items")
    .select("id,content_type,hosting_mode,status")
    .eq("id", body.contentId)
    .maybeSingle();

  if (!content || !["self_host_open", "self_host_owned"].includes(content.hosting_mode)) {
    return NextResponse.json({ error: "Content is not configured for self-hosting." }, { status: 409 });
  }
  if (content.status === "published") return NextResponse.json({ error: "Create a new content version before replacing published media." }, { status: 409 });

  const assetId = crypto.randomUUID();
  const extension = safeMediaExtension(body.filename);
  const storageKey = `incoming/${body.contentId}/${assetId}/source.${extension}`;
  const pipeline = selectPipeline({ contentType: content.content_type, durationSeconds: body.durationSeconds });

  const { error } = await context.supabase.from("media_assets").insert({
    id: assetId,
    content_id: body.contentId,
    kind: "source_video",
    status: "pending_upload",
    storage_key: storageKey,
    mime_type: body.mimeType,
    size_bytes: body.sizeBytes,
    created_by: context.user.id,
    metadata: { original_filename: body.filename, pipeline },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    const uploadUrl = await createUploadUrl({ key: storageKey, contentType: body.mimeType, sizeBytes: body.sizeBytes });
    return NextResponse.json({ assetId, uploadUrl, storageKey, pipeline });
  } catch (error) {
    await context.supabase.from("media_assets").update({ status: "failed", metadata: { upload_error: String(error) } }).eq("id", assetId);
    return NextResponse.json({ error: "Media storage is not configured." }, { status: 503 });
  }
}
