import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  return (
    <div className="page-shell">
      <div className="section-heading"><div><span className="eyebrow">Account</span><h1>Your profile</h1></div></div>
      <div className="form-shell"><p>Signed in as <strong>{user.email ?? user.phone ?? "Jalwa user"}</strong>.</p></div>
    </div>
  );
}
