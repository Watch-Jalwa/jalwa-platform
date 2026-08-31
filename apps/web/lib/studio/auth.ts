import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";

const STAFF_ROLES = new Set(["editor", "rights_reviewer", "support", "finance", "admin"]);

export async function requireStaff() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login?next=/studio");
  const { data: profile } = await database.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  if (!profile || !STAFF_ROLES.has(profile.role)) redirect("/");
  return { database, user, profile };
}
