import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const params = await searchParams;
  const requestNotice = typeof params.request === "string" ? notices[params.request] : null;
  const { data: requests } = await supabase
    .from("account_requests")
    .select("id,request_type,status,requested_at")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(5);

  return (
    <div className="page-shell profile-page">
      <div className="section-heading"><div><span className="eyebrow">Account</span><h1>Your profile</h1></div></div>
      {requestNotice ? <p className="policy-notice" role="status">{requestNotice}</p> : null}

      <section className="account-card">
        <h2>Account</h2>
        <p>Signed in as <strong>{user.email ?? user.phone ?? "Jalwa user"}</strong>.</p>
        <div className="account-actions"><Link className="button button-primary" href="/billing">Billing</Link><Link className="button button-secondary" href="/support">Support</Link></div>
      </section>

      <section className="account-card">
        <h2>Privacy requests</h2>
        <p>Request a copy of account information or ask Jalwa to review your account for deletion. Financial, rights, fraud-prevention and audit records may require retention.</p>
        <form action={requestAccountExport}><button className="button button-secondary" type="submit">Request data export</button></form>
        <form action={requestAccountDeletion} className="danger-form">
          <label className="form-field">Type DELETE to request deletion<input name="confirmation" autoComplete="off" /></label>
          <button className="button button-danger" type="submit">Request account deletion</button>
        </form>
      </section>

      <section className="account-card">
        <h2>Recent requests</h2>
        {requests?.length ? <ul className="request-list">{requests.map((request) => <li key={request.id}><span>{request.request_type}</span><strong>{request.status}</strong><time>{new Date(request.requested_at).toLocaleDateString("en-PK")}</time></li>)}</ul> : <p>No privacy requests yet.</p>}
      </section>

      <form action={signOut}><button className="button button-secondary" type="submit">Sign out</button></form>
    </div>
  );
}
