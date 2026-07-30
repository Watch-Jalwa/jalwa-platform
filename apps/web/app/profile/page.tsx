import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig, isFrontendPreview } from "@/lib/runtime";
import { requestAccountDeletion, requestAccountExport, signOut } from "./actions";

export const metadata = { title: "Profile" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const notices: Record<string, string> = {
  "export-received": "Your data-export request has been recorded.",
  "deletion-received": "Your account-deletion request has been recorded for review.",
  "deletion-confirmation": "Type DELETE to confirm the account-deletion request.",
  "export-failed": "The export request could not be created.",
  "deletion-failed": "The deletion request could not be created.",
};

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = isFrontendPreview() || !hasSupabaseConfig();
  let identity = "preview@watch-jalwa.com";
  let displayName = "Jalwa Viewer";
  let language = "English";
  let requests: { id: string; request_type: string; status: string; requested_at: string }[] = [];
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/profile");
    identity = user.email ?? user.phone ?? "Jalwa user";
    const [{ data: profile }, { data: requestRows }] = await Promise.all([
      supabase.from("profiles").select("display_name,preferred_language").eq("id", user.id).maybeSingle(),
      supabase.from("account_requests").select("id,request_type,status,requested_at").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(5),
    ]);
    displayName = profile?.display_name ?? identity;
    language = profile?.preferred_language ?? "en";
    requests = requestRows ?? [];
  }
  const requestNotice = typeof params.request === "string" ? notices[params.request] : params.onboarding ? "Your Jalwa profile setup is complete." : null;
  const hubs = [
    { href: "/profiles", title: "Viewer profiles", copy: "Family members, kids mode and active profile." },
    { href: "/history", title: "Watch history", copy: "Resume titles and manage viewing history." },
    { href: "/offline", title: "Offline downloads", copy: "Self-hosted MP4 titles stored on this browser." },
    { href: "/devices", title: "Devices", copy: "Review and revoke signed-in browsers." },
    { href: "/billing", title: "Billing", copy: "Membership, orders and payment history." },
    { href: "/support", title: "Support", copy: "Get help with access, payments or content." },
  ];
  return <div className="page-shell profile-page"><div className="profile-hero"><div className="profile-monogram">{displayName.slice(0,1).toUpperCase()}</div><div><span className="eyebrow">Account</span><h1>{displayName}</h1><p>{identity} · {language}</p></div></div>{requestNotice ? <p className="policy-notice" role="status">{requestNotice}</p> : null}<section className="account-hub">{hubs.map((hub) => <Link href={hub.href} className="hub-card" key={hub.href}><h2>{hub.title}</h2><p>{hub.copy}</p><span>Open →</span></Link>)}</section><section className="account-card"><h2>Privacy requests</h2><p>Request a copy of account information or ask Jalwa to review your account for deletion. Financial, rights, fraud-prevention and audit records may require retention.</p><div className="account-actions"><form action={requestAccountExport}><button className="button button-secondary" type="submit" disabled={preview}>Request data export</button></form></div><form action={requestAccountDeletion} className="danger-form"><label className="form-field">Type DELETE to request deletion<input name="confirmation" autoComplete="off" disabled={preview} /></label><button className="button button-danger" type="submit" disabled={preview}>Request account deletion</button></form></section>{requests.length ? <section className="account-card"><h2>Recent requests</h2><ul className="request-list">{requests.map((request) => <li key={request.id}><span>{request.request_type}</span><strong>{request.status}</strong><time>{new Date(request.requested_at).toLocaleDateString("en-PK")}</time></li>)}</ul></section> : null}<form action={signOut}><button className="button button-secondary" type="submit" disabled={preview}>Sign out</button></form>{preview ? <p className="policy-notice">Preview account data is illustrative. Production reads the signed-in user from Supabase.</p> : null}</div>;
}
