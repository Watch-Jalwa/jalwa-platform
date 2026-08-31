import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { deviceKey?: string; displayName?: string; platform?: string; userAgent?: string };
  if (!body.deviceKey || body.deviceKey.length < 8) return NextResponse.json({ ok: false }, { status: 400 });
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await database.rpc("register_device", {
    p_device_key: body.deviceKey,
    p_display_name: body.displayName ?? "Web browser",
    p_platform: body.platform ?? "",
    p_user_agent: body.userAgent ?? "",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, deviceId: data });
}
