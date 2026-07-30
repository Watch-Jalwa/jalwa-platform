import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig, isFrontendPreview } from "@/lib/runtime";
import { clearWatchHistory } from "./actions";

export const metadata = { title: "Watch history" };
const demo = [
  { content_id: "demo-1", position_seconds: 315, duration_seconds: 1160, completed: false, last_watched_at: new Date().toISOString(), content_items: { slug: "neural-network-visual-introduction", title: "But what is a neural network?", title_ur: "نیورل نیٹ ورک کیا ہے؟", thumbnail_url: null } },
  { content_id: "demo-2", position_seconds: 596, duration_seconds: 596, completed: true, last_watched_at: new Date(Date.now()-86400000).toISOString(), content_items: { slug: "big-buck-bunny-open-movie", title: "Big Buck Bunny — open movie", title_ur: null, thumbnail_url: null } },
];

export default async function HistoryPage() {
  const preview = isFrontendPreview() || !hasSupabaseConfig();
  let profileName = "Preview viewer";
  let history = demo;
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/history");
    const profile = await getActiveViewerProfile(user.id);
    profileName = profile?.name ?? "Viewer";
    const { data } = profile ? await supabase.from("watch_progress").select("content_id,position_seconds,duration_seconds,completed,last_watched_at,content_items(slug,title,title_ur,thumbnail_url)").eq("user_id", user.id).eq("viewer_profile_id", profile.id).order("last_watched_at", { ascending: false }).limit(100) : { data: [] };
    history = (data ?? []) as unknown as typeof demo;
  }
  return <div className="page-shell history-page"><div className="section-heading"><div><span className="eyebrow">{profileName}</span><h1>Continue watching</h1></div><form action={clearWatchHistory}><button className="button button-secondary" disabled={preview || !history.length} type="submit">Clear history</button></form></div>{history.length ? <div className="history-list">{history.map((item) => { const content = item.content_items; const percent = item.duration_seconds ? Math.min(100, Math.round(item.position_seconds/item.duration_seconds*100)) : 0; return <Link className="history-card" href={`/watch/${content.slug}`} key={item.content_id}><div className="history-art" style={content.thumbnail_url ? { backgroundImage: `url(${content.thumbnail_url})` } : undefined}><span>{item.completed ? "Watched" : `${percent}%`}</span></div><div><h2>{content.title}</h2>{content.title_ur ? <p className="urdu">{content.title_ur}</p> : null}<div className="progress-track"><span style={{ width: `${percent}%` }} /></div><small>{new Date(item.last_watched_at).toLocaleDateString("en-PK")}</small></div></Link>; })}</div> : <div className="empty-state"><h2>No watch history yet</h2><p>Start a video and it will appear here.</p><Link className="button button-primary" href="/explore">Explore Jalwa</Link></div>}</div>;
}
