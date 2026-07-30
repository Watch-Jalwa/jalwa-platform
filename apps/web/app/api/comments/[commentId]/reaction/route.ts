import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ commentId: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  const { commentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to react." }, { status: 401 });
  const { data, error } = await supabase.rpc("toggle_comment_reaction", { p_comment_id: commentId, p_reaction: "like" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, score: data });
}
