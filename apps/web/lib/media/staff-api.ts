import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

const STAFF_ROLES = new Set(["editor", "rights_reviewer", "support", "finance", "admin"]);

export async function getStaffApiContext() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !STAFF_ROLES.has(profile.role)) return { error: NextResponse.json({ error: "Staff access required." }, { status: 403 }) };
  return { database, user, profile };
}
