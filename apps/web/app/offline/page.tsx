import { redirect } from "next/navigation";
import { OfflineLibrary } from "@/components/offline-library";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";
import { canUseDemoData, hasSupabaseConfig } from "@/lib/runtime";

export const metadata = { title: "Offline downloads" };

export default async function OfflinePage() {
  const preview = canUseDemoData();
  if (!preview && !hasSupabaseConfig()) throw new Error("Offline library database is not configured.");
  let items: { id: string; contentId: string; title: string; cacheKey: string; downloadedAt: string; bytesDownloaded: number; expiresAt: string }[] = [];
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/offline");
    const profile = await getActiveViewerProfile(user.id);
    const { data, error } = profile
      ? await supabase.from("offline_items")
        .select("id,content_id,cache_key,bytes_downloaded,downloaded_at,expires_at,content_items(title_en)")
        .eq("user_id", user.id)
        .eq("viewer_profile_id", profile.id)
        .gt("expires_at", new Date().toISOString())
        .order("downloaded_at", { ascending: false })
      : { data: [], error: null };
    if (error) throw error;
    items = (data ?? []).flatMap((item) => item.expires_at ? [{
      id: item.id,
      contentId: item.content_id,
      title: (item.content_items as { title_en?: string } | null)?.title_en ?? "Downloaded title",
      cacheKey: item.cache_key,
      downloadedAt: item.downloaded_at,
      bytesDownloaded: item.bytes_downloaded,
      expiresAt: item.expires_at,
    }] : []);
  }
  return <div className="page-shell offline-page"><div className="section-heading"><div><span className="eyebrow">On this device</span><h1>Offline downloads</h1><p>Only public, self-hosted MP4 titles can be stored unencrypted. Premium and embedded content remain online-only.</p></div></div>{preview ? <div className="empty-state"><h2>Offline UI is ready</h2><p>Sign in on the production deployment and choose “Save offline” on an eligible public title.</p></div> : items.length ? <OfflineLibrary items={items} /> : <div className="empty-state"><h2>No active downloads on this browser</h2><p>Open an eligible public self-hosted title and select “Save offline”.</p></div>}</div>;
}
