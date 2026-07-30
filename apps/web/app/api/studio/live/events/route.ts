import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function editor() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["editor","admin"].includes(profile.role)) return { response: NextResponse.json({ error: "Editor role required." }, { status: 403 }) } as const;
  return { supabase } as const;
}

export async function POST(request: Request) {
  const auth = await editor(); if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({})) as { channelId?: string; title?: string; titleUrdu?: string; description?: string; scheduledStart?: string; scheduledEnd?: string | null; publish?: boolean };
  const start = body.scheduledStart ? new Date(body.scheduledStart) : null; const end = body.scheduledEnd ? new Date(body.scheduledEnd) : null;
  if (!body.channelId || !body.title?.trim() || !start || Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end<=start))) return NextResponse.json({ error: "Valid channel, title and schedule are required." }, { status: 400 });
  const { data, error } = await auth.supabase.from("live_events").insert({ channel_id: body.channelId, title_en: body.title.trim(), title_ur: body.titleUrdu?.trim() || null, description_en: body.description?.trim() || null, scheduled_start: start.toISOString(), scheduled_end: end?.toISOString() ?? null, status: body.publish ? "scheduled" : "draft" }).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ event: data });
}

export async function PATCH(request: Request) {
  const auth = await editor(); if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({})) as { id?: string; status?: string; title?: string; actualStart?: string | null; actualEnd?: string | null };
  if (!body.id) return NextResponse.json({ error: "Event id required." }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (body.status && ["draft","scheduled","live","ended","cancelled"].includes(body.status)) update.status = body.status;
  if (body.title?.trim()) update.title_en = body.title.trim();
  if (body.actualStart) update.actual_start = new Date(body.actualStart).toISOString();
  if (body.actualEnd) update.actual_end = new Date(body.actualEnd).toISOString();
  const { data, error } = await auth.supabase.from("live_events").update(update).eq("id", body.id).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ event: data });
}
