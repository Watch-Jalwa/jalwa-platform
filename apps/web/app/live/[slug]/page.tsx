import { notFound } from "next/navigation";
import { LivePlayer } from "@/components/live-player";
import { hasSupabaseConfig } from "@/lib/runtime";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

type Channel = { id: string; slug: string; title_en: string; title_ur: string | null; description_en: string | null; poster_url: string | null; access_level: string; status: string; live_events?: Array<{ id: string; title_en: string; title_ur: string | null; description_en: string | null; scheduled_start: string; scheduled_end: string | null; status: string }> };

async function getChannel(slug: string): Promise<Channel | null> {
  if (!hasSupabaseConfig()) return slug === "jalwa-live-preview" ? { id: "demo-live", slug, title_en: "Jalwa Live channel preview", title_ur: "جلوہ لائیو", description_en: "The browser channel page, schedule and player states are ready. Connect an authorized live input to begin broadcasting.", poster_url: null, access_level: "public", status: "scheduled", live_events: [{ id: "demo-event", title_en: "First Jalwa broadcast", title_ur: "پہلی جلوہ نشریات", description_en: "A scheduled preview event.", scheduled_start: new Date(Date.now()+86400000).toISOString(), scheduled_end: null, status: "scheduled" }] } : null;
  const supabase = await createClient();
  const { data } = await supabase.from("live_channels").select("id,slug,title_en,title_ur,description_en,poster_url,access_level,status,live_events(id,title_en,title_ur,description_en,scheduled_start,scheduled_end,status)").eq("slug", slug).eq("is_published", true).maybeSingle();
  return data as Channel | null;
}

export default async function LiveChannelPage({ params }: { params: Params }) {
  const { slug } = await params; const channel = await getChannel(slug); if (!channel) notFound();
  const events = channel.live_events?.sort((a,b) => +new Date(a.scheduled_start)-+new Date(b.scheduled_start)) ?? [];
  return <div className="page-shell live-watch-page">
    <section className="live-watch-grid"><div className="player-shell">{channel.id === "demo-live" ? <div className="player-placeholder live-placeholder"><span className="live-dot" /><p>This preview channel is scheduled, not broadcasting. Production live playback activates after an input is connected.</p></div> : <LivePlayer channelId={channel.id} poster={channel.poster_url} title={channel.title_en} />}</div><article><span className="eyebrow">{channel.status} · {channel.access_level}</span><h1>{channel.title_en}</h1>{channel.title_ur ? <p className="urdu watch-urdu">{channel.title_ur}</p> : null}<p>{channel.description_en}</p></article></section>
    <section><div className="section-heading"><div><span className="eyebrow">Programme guide</span><h2>Schedule</h2></div></div><div className="programme-list">{events.length ? events.map((event) => <article key={event.id}><time>{new Date(event.scheduled_start).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</time><div><h3>{event.title_en}</h3>{event.title_ur ? <p className="urdu">{event.title_ur}</p> : null}<p>{event.description_en}</p></div><span>{event.status}</span></article>) : <p>No scheduled programmes.</p>}</div></section>
  </div>;
}
