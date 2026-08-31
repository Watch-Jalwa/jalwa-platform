import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import { hasBackendConfiguration, isFrontendPreview } from "@/lib/runtime";
import { revokeDevice } from "./actions";

export const metadata = { title: "Devices" };
const demoDevices = [
  { id: "demo-1", display_name: "Windows browser", platform: "Win32", last_seen_at: new Date().toISOString(), revoked_at: null },
  { id: "demo-2", display_name: "Android browser", platform: "Android", last_seen_at: new Date(Date.now()-86400000*2).toISOString(), revoked_at: null },
];

export default async function DevicesPage() {
  const preview = isFrontendPreview() || !hasBackendConfiguration();
  let devices = demoDevices;
  if (!preview) {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) redirect("/login?next=/devices");
    const { data } = await database.from("user_devices").select("id,display_name,platform,last_seen_at,revoked_at").eq("user_id", user.id).order("last_seen_at", { ascending: false });
    devices = data ?? [];
  }
  return <div className="page-shell devices-page"><div className="section-heading"><div><span className="eyebrow">Security</span><h1>Your devices</h1><p>Browsers register after sign-in. Revoke a device to require a fresh session before protected playback.</p></div></div><div className="device-list">{devices.map((device) => <article className="device-card" key={device.id}><div><h2>{device.display_name}</h2><p>{device.platform || "Unknown platform"}</p><small>Last active {new Date(device.last_seen_at).toLocaleString("en-PK")}</small></div><form action={revokeDevice}><input name="deviceId" type="hidden" value={device.id} /><button className="button button-secondary" type="submit" disabled={preview || Boolean(device.revoked_at)}>{device.revoked_at ? "Revoked" : "Revoke"}</button></form></article>)}</div><p className="policy-notice">Playback enforcement uses the device record together with the signed media token. Configure the final concurrent-device limit in the playback gateway before launch.</p></div>;
}
