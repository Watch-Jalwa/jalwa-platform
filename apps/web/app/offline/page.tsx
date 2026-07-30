import { redirect } from "next/navigation";
import { OfflineLibrary } from "@/components/offline-library";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig, isFrontendPreview } from "@/lib/runtime";

export const metadata = { title: "Offline downloads" };

export default async function OfflinePage() {
  const preview = isFrontendPreview() || !hasSupabaseConfig();
  let items: { id: string; contentId: string; title: string; cacheKey: string; downloadedAt: string; bytesDownloaded: number }[] = [];
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/offline");
    const profile = await getActiveViewerProfile(user.id);
    const { data } = profile ? await supabase.from("offline_items").select("id,content_id,cache_key,bytes_downloaded,downloaded_at,content_items(title)").eq("user_id", user.id).eq("viewer_profile_id", profile.id).order("downloaded_at", { ascending: false }) : { data: [] };
    items = (data ?? []).map((item) => ({ id: item.id, contentId: item.content_id, title: (item.content_items as { title?: string } | null)?.title ?? "Downloaded title", cacheKey: item.cache_key, downloadedAt: item.downloaded_at, bytesDownloaded: item.bytes_downloaded }));
  }
  return <div className="page-shell offline-page"><div className="section-heading"><div><span className="eyebrow">On this device</span><h1>Offline downloads</h1><p>Only licensed, self-hosted MP4 titles can be saved. Embedded providers are never downloaded.</p></div></div>{preview ? <div className="empty-state"><h2>Offline UI is ready</h2><p>Sign in on the production deployment and choose “Save offline” on an eligible title.</p></div> : items.length ? <OfflineLibrary items={items} /> : <div className="empty-state"><h2>No downloads on this browser</h2><p>Open an eligible self-hosted title and select “Save offline”.</p></div>}</div>;
}
