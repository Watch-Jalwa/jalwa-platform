import Link from "next/link";
import { hasSupabaseConfig } from "@/lib/runtime";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

type Channel = { id: string; slug: string; title_en: string; title_ur: string | null; description_en: string | null; poster_url: string | null; access_level: string; status: string; live_events?: Array<{ title_en: string; scheduled_start: string; status: string }> };

async function channels(): Promise<Channel[]> {
  if (!hasSupabaseConfig()) return [{ id: "demo-live", slug: "jalwa-live-preview", title_en: "Jalwa Live channel preview", title_ur: "جلوہ لائیو", description_en: "The channel guide is ready. A real broadcast appears here after an authorized live input is connected.", poster_url: null, access_level: "public", status: "scheduled", live_events: [{ title_en: "First Jalwa broadcast", scheduled_start: new Date(Date.now()+86400000).toISOString(), status: "scheduled" }] }];
  const supabase = await createClient();
  const { data } = await supabase.from("live_channels").select("id,slug,title_en,title_ur,description_en,poster_url,access_level,status,live_events(title_en,scheduled_start,status)").eq("is_published", true).order("status", { ascending: false }).order("updated_at", { ascending: false });
  return (data ?? []) as Channel[];
}

export default async function LivePage() {
  const items = await channels();
  const active = items.filter((channel) => channel.status === "live");
  const upcoming = items.filter((channel) => channel.status !== "live");
  return <div className="page-shell live-guide"><section className="live-hero"><span className="eyebrow">Jalwa Live</span><h1>Live channels and original broadcasts.</h1><p>Watch scheduled programmes, recurring channels and special events in your browser. Premium and registered streams are protected by Jalwa access controls.</p></section>
    <section><div className="section-heading"><div><span className="live-dot" /><h2>Live now</h2></div></div><div className="live-channel-grid">{active.length ? active.map((channel) => <ChannelCard channel={channel} key={channel.id} />) : <div className="empty-state"><h3>No broadcast is live right now</h3><p>Upcoming events remain listed below.</p></div>}</div></section>
    <section><div className="section-heading"><div><span className="eyebrow">Schedule</span><h2>Channels and upcoming events</h2></div></div><div className="live-channel-grid">{upcoming.map((channel) => <ChannelCard channel={channel} key={channel.id} />)}</div></section>
  </div>;
}

function ChannelCard({ channel }: { channel: Channel }) {
  const event = channel.live_events?.sort((a,b) => +new Date(a.scheduled_start)-+new Date(b.scheduled_start))[0];
  return <article className="live-channel-card"><Link href={`/live/${channel.slug}`}><div className="live-channel-art" style={channel.poster_url ? { backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.88)),url(${channel.poster_url})` } : undefined}><span className={channel.status === "live" ? "live-badge" : "channel-status"}>{channel.status === "live" ? "LIVE" : channel.status}</span><span>{channel.access_level === "premium" ? "Premium" : "Watch in browser"}</span></div><h3>{channel.title_en}</h3>{channel.title_ur ? <p className="urdu">{channel.title_ur}</p> : null}<p>{event ? `${event.title_en} · ${new Date(event.scheduled_start).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}` : channel.description_en ?? "Channel schedule coming soon."}</p></Link></article>;
}
