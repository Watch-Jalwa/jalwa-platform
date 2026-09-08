import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";

const STAFF_ROLES = new Set(["editor", "rights_reviewer", "support", "finance", "admin"]);

export async function requireStaff() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login?next=/studio");
  const { data: profile } = await database.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/");
  if (!STAFF_ROLES.has(profile.role)) {
    // Subscribers can encounter Studio-only links such as finance reports. Keep
    // them outside the Studio shell, but explain the authorization boundary
    // instead of silently sending them home. Plain viewers retain the existing
    // hard-denial redirect used by the least-privilege certification.
    if (profile.role === "subscriber") redirect("/permission-denied?scope=studio");
    redirect("/");
  }
  return { database, user, profile };
}
