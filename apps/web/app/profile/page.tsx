import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseDemoData, hasSupabaseConfig } from "@/lib/runtime";
import { cancelAccountDeletion, requestAccountDeletion, requestAccountExport, signOut } from "./actions";

export const metadata = { title: "Profile" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type AccountRequest = { id: string; request_type: "export" | "deletion"; status: string; requested_at: string; completed_at: string | null; result_expires_at: string | null; deletion_execute_after: string | null };
const notices: Record<string, string> = {
  "export-received": "Your data export was queued. A private download will appear below when it is ready.",
  "deletion-received": "Your deletion request was scheduled with a seven-day cancellation period.",
  "deletion-confirmation": "Type DELETE to confirm the account-deletion request.",
  "deletion-cancelled": "Your account-deletion request was cancelled.",
  "deletion-cancel-failed": "The deletion request could not be cancelled. It may already be processing.",
  "export-failed": "The export request could not be created.",
  "deletion-failed": "The deletion request could not be created.",
};

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = canUseDemoData();
  if (!preview && !hasSupabaseConfig()) throw new Error("Account database is not configured.");
  let identity = "preview@watch-jalwa.com";
  let displayName = "Jalwa Viewer";
  let language = "English";
  let requests: AccountRequest[] = [];
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/profile");
    identity = user.email ?? user.phone ?? "Jalwa user";
    const [profileResult, requestResult] = await Promise.all([
      supabase.from("profiles").select("display_name,preferred_language").eq("id", user.id).maybeSingle(),
      supabase.from("account_requests").select("id,request_type,status,requested_at,completed_at,result_expires_at,deletion_execute_after").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(10),
    ]);
    if (profileResult.error || requestResult.error) throw profileResult.error ?? requestResult.error;
    displayName = profileResult.data?.display_name ?? identity;
    language = profileResult.data?.preferred_language ?? "en";
    requests = (requestResult.data ?? []) as AccountRequest[];
  }
  const requestNotice = typeof params.request === "string" ? notices[params.request] : params.onboarding ? "Your Jalwa profile setup is complete." : null;
  const hubs = [
    { href: "/profiles", title: "Viewer profiles", copy: "Family members, kids mode and active profile." },
    { href: "/history", title: "Watch history", copy: "Resume titles and manage viewing history." },
    { href: "/offline", title: "Offline downloads", copy: "Public MP4 titles stored temporarily on this browser." },
    { href: "/devices", title: "Devices", copy: "Review and revoke signed-in browsers." },
    { href: "/billing", title: "Billing", copy: "Membership, orders and payment history." },
    { href: "/support", title: "Support", copy: "Get help with access, payments or content." },
  ];
  return <div className="page-shell profile-page"><div className="profile-hero"><div className="profile-monogram">{displayName.slice(0, 1).toUpperCase()}</div><div><span className="eyebrow">Account</span><h1>{displayName}</h1><p>{identity} · {language}</p></div></div>{requestNotice ? <p className="policy-notice" role="status">{requestNotice}</p> : null}<section className="account-hub">{hubs.map((hub) => <Link href={hub.href} className="hub-card" key={hub.href}><h2>{hub.title}</h2><p>{hub.copy}</p><span>Open →</span></Link>)}</section><section className="account-card"><h2>Privacy requests</h2><p>Exports are generated as private compressed JSON files and expire after 24 hours. Account deletion starts after a seven-day grace period. Financial, rights, fraud-prevention and audit records that require retention are de-identified.</p><div className="account-actions"><form action={requestAccountExport}><button className="button button-secondary" type="submit" disabled={preview}>Request data export</button></form></div><form action={requestAccountDeletion} className="danger-form"><label className="form-field">Type DELETE to schedule deletion<input name="confirmation" autoComplete="off" disabled={preview} /></label><button className="button button-danger" type="submit" disabled={preview}>Schedule account deletion</button></form></section>{requests.length ? <section className="account-card"><h2>Recent requests</h2><ul className="request-list">{requests.map((request) => { const exportReady = request.request_type === "export" && request.status === "completed"; const deletionCancellable = request.request_type === "deletion" && ["requested", "in_review", "failed"].includes(request.status); return <li key={request.id}><span>{request.request_type}</span><strong>{request.status}</strong><time>{new Date(request.requested_at).toLocaleDateString("en-PK")}</time>{exportReady ? <><Link className="button button-primary" href={`/api/account/export/${request.id}`}>Download export</Link>{request.result_expires_at ? <small>Available until {new Date(request.result_expires_at).toLocaleString("en-PK")}. The download endpoint enforces expiry.</small> : null}</> : null}{deletionCancellable ? <form action={cancelAccountDeletion}><input type="hidden" name="requestId" value={request.id} /><button className="button button-secondary" type="submit">Cancel deletion</button>{request.deletion_execute_after ? <small>Scheduled after {new Date(request.deletion_execute_after).toLocaleDateString("en-PK")}. Cancellation is verified by the server.</small> : null}</form> : null}</li>; })}</ul></section> : null}<form action={signOut}><button className="button button-secondary" type="submit" disabled={preview}>Sign out</button></form>{preview ? <p className="policy-notice">Preview account data is illustrative. Production reads the signed-in user from Supabase.</p> : null}</div>;
}
