import { redirect } from "next/navigation";
import { StudioLiveManager } from "@/components/studio-live-manager";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Live operations" };
export const dynamic = "force-dynamic";

export default async function StudioLivePage() {
  const { supabase, profile } = await requireStaff();
  if (!["editor","admin"].includes(profile.role)) redirect("/studio");
  const { data } = await supabase.from("live_channels").select("id,slug,title_en,status,provider,access_level,is_published,provider_input_id,live_events(id,title_en,scheduled_start,status)").order("updated_at", { ascending: false });
  return <div><div className="section-heading"><div><span className="eyebrow">Original broadcasts</span><h1>Live operations</h1></div></div><StudioLiveManager initialChannels={data ?? []} /></div>;
}
