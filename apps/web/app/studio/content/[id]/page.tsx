import { notFound } from "next/navigation";
import { approveRightsAction, publishContentAction, submitRightsReviewAction } from "@/app/studio/actions";
import { MediaUploader } from "@/components/media-uploader";
import { requireStaff } from "@/lib/studio/auth";

type Params = Promise<{ id: string }>;

export default async function StudioContentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  const [{ data: item }, { data: rights }, { data: playback }, { data: assets }] = await Promise.all([
    supabase.from("content_items").select("id,slug,title_en,title_ur,status,content_type,hosting_mode,access_level,description_en").eq("id", id).maybeSingle(),
    supabase.from("rights_records").select("id,status,source_url,creator,attribution_text,embedding_confirmed,self_hosting_confirmed,commercial_use_confirmed,verified_at").eq("content_id", id).maybeSingle(),
    supabase.from("playback_sources").select("provider,external_url,format,status").eq("content_id", id).eq("is_primary", true).maybeSingle(),
    supabase.from("media_assets").select("id,kind,status,size_bytes,created_at").eq("content_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!item) notFound();
  const canApprove = profile.role === "rights_reviewer" || profile.role === "admin";
  const selfHosted = ["self_host_open", "self_host_owned"].includes(item.hosting_mode);
  return <div><div className="section-heading"><div><span className="eyebrow">{item.status}</span><h1>{item.title_en}</h1></div></div><div className="studio-grid"><section className="panel"><h2>Catalogue record</h2><dl className="detail-list"><div><dt>Slug</dt><dd>{item.slug}</dd></div><div><dt>Type</dt><dd>{item.content_type}</dd></div><div><dt>Hosting</dt><dd>{item.hosting_mode}</dd></div><div><dt>Access</dt><dd>{item.access_level}</dd></div><div><dt>Provider</dt><dd>{playback?.provider ?? "Not assigned"}</dd></div><div><dt>Playback</dt><dd>{playback?.format ?? playback?.status ?? "Not ready"}</dd></div></dl></section><section className="panel"><h2>Rights</h2>{rights ? <dl className="detail-list"><div><dt>Status</dt><dd>{rights.status}</dd></div><div><dt>Source</dt><dd>{rights.source_url}</dd></div><div><dt>Embed</dt><dd>{rights.embedding_confirmed ? "Confirmed" : "No"}</dd></div><div><dt>Self-host</dt><dd>{rights.self_hosting_confirmed ? "Confirmed" : "No"}</dd></div></dl> : <p>No rights record exists.</p>}</section>{selfHosted ? <section className="panel"><h2>Media processing</h2><MediaUploader contentId={id} /><div className="asset-list">{(assets ?? []).map((asset) => <div key={asset.id}><span>{asset.kind}</span><strong>{asset.status}</strong></div>)}</div></section> : null}</div><div className="action-row">{item.status === "draft" ? <form action={submitRightsReviewAction}><input name="id" type="hidden" value={id} /><button className="button button-secondary" type="submit">Submit for rights review</button></form> : null}{canApprove && rights?.status === "pending" ? <form action={approveRightsAction}><input name="id" type="hidden" value={id} /><input name="rightsId" type="hidden" value={rights.id} /><button className="button button-secondary" type="submit">Approve rights</button></form> : null}{rights?.status === "approved" && item.status !== "published" ? <form action={publishContentAction}><input name="id" type="hidden" value={id} /><button className="button button-primary" type="submit">Publish</button></form> : null}</div></div>;
}
