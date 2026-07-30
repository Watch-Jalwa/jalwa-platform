import { NextResponse } from "next/server";
import { verifyUploadedObject } from "@/lib/media/storage";
import { getStaffApiContext } from "@/lib/media/staff-api";

export const runtime = "nodejs";
type Params = Promise<{ assetId: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  const context = await getStaffApiContext();
  if ("error" in context) return context.error;
  const { assetId } = await params;

  const { data: asset } = await context.supabase
    .from("media_assets")
    .select("id,storage_key,size_bytes,metadata,status")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  if (asset.status !== "pending_upload") return NextResponse.json({ error: "Upload is not pending." }, { status: 409 });

  try {
    const uploaded = await verifyUploadedObject(asset.storage_key);
    if (!uploaded.sizeBytes) throw new Error("Object is empty");
    const pipeline = asset.metadata?.pipeline === "short_mp4" ? "short_mp4" : "hls";
    const { error } = await context.supabase.from("media_assets").update({
      status: "queued",
      size_bytes: uploaded.sizeBytes,
      mime_type: uploaded.contentType ?? undefined,
    }).eq("id", asset.id);
    if (error) throw error;

    const { error: jobError } = await context.supabase.from("media_jobs").insert({
      media_asset_id: asset.id,
      job_type: pipeline,
      status: "queued",
    });
    if (jobError) throw jobError;
    return NextResponse.json({ status: "queued", pipeline });
  } catch (error) {
    return NextResponse.json({ error: `Upload verification failed: ${String(error)}` }, { status: 400 });
  }
}
