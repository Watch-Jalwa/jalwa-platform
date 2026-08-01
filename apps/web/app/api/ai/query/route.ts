import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRetrievalQuery } from "@/lib/ai/grounding.mjs";
import { createGroundedAnswer, moderateQuestion, type GroundedSource } from "@/lib/ai/openai";
import { AiRequestBodyError, readAiRequestBody } from "@/lib/ai/request.mjs";

export const runtime = "nodejs";

function language(value: unknown): "en" | "ur" | "roman_ur" {
  return value === "ur" || value === "roman_ur" ? value : "en";
}

function tokenValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await readAiRequestBody(request, Number(process.env.AI_REQUEST_MAX_BYTES ?? 16_384));
    } catch (error) {
      if (error instanceof AiRequestBodyError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (question.length < 3 || question.length > 1200) {
      return NextResponse.json({ error: "Question must be between 3 and 1,200 characters." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to use Ask Jalwa.", code: "sign_in_required" }, { status: 401 });

    const selectedLanguage = language(body.language);
    const { data: hasAiPlus } = await supabase.rpc("has_active_benefit", { p_benefit: "ai_plus" });
    const dailyLimit = hasAiPlus
      ? Number(process.env.AI_PREMIUM_DAILY_LIMIT ?? 50)
      : Number(process.env.AI_FREE_DAILY_LIMIT ?? 5);
    const { data: quotaAccepted, error: quotaError } = await supabase.rpc("consume_ai_quota", {
      p_feature: "ask_jalwa",
      p_limit: dailyLimit,
    });
    if (quotaError) throw quotaError;
    if (!quotaAccepted) {
      return NextResponse.json({ error: "Your daily Ask Jalwa allowance has been used.", code: "quota_exceeded" }, { status: 429 });
    }

    if (await moderateQuestion(question)) {
      return NextResponse.json({ error: "This request cannot be answered by Ask Jalwa.", code: "moderated" }, { status: 400 });
    }

    const query = buildRetrievalQuery(question);
    const { data: searchRows, error: searchError } = await supabase.rpc("search_catalogue", {
      p_query: query || question.slice(0, 120),
      p_category: null,
      p_limit: 6,
    });
    if (searchError) throw searchError;

    const rows = ((searchRows ?? []) as Array<Record<string, unknown>>).filter((row) => typeof row.id === "string");
    const contextContentId = typeof body.contentId === "string" ? body.contentId : null;
    if (contextContentId && !rows.some((row) => row.id === contextContentId)) {
      const { data: context } = await supabase
        .from("content_items")
        .select("id,slug,title_en,description_en,language,primary_category_id")
        .eq("id", contextContentId)
        .eq("status", "published")
        .maybeSingle();
      if (context) rows.unshift({
        id: context.id,
        slug: context.slug,
        title: context.title_en,
        description: context.description_en,
        language: context.language,
        category_name: "Current Jalwa title",
      });
    }

    const ids = rows.map((row) => String(row.id)).slice(0, 6);
    const rightsByContent = new Map<string, string>();
    if (ids.length) {
      const { data: rights } = await supabase
        .from("rights_records")
        .select("content_id,attribution_text")
        .in("content_id", ids)
        .eq("status", "approved");
      for (const record of rights ?? []) {
        if (record.attribution_text) rightsByContent.set(record.content_id, record.attribution_text);
      }
    }

    const sources: GroundedSource[] = rows.slice(0, 6).map((row) => ({
      id: String(row.id),
      slug: typeof row.slug === "string" ? row.slug : "explore",
      title: typeof row.title === "string" ? row.title : typeof row.title_en === "string" ? row.title_en : "Jalwa content",
      description: typeof row.description === "string" ? row.description : typeof row.description_en === "string" ? row.description_en : null,
      category: typeof row.category_name === "string" ? row.category_name : null,
      language: typeof row.language === "string" ? row.language : null,
      attribution: rightsByContent.get(String(row.id)) ?? null,
    }));

    const answer = await createGroundedAnswer({ question, language: selectedLanguage, sources });
    const usage = answer.usage as { input_tokens?: unknown; output_tokens?: unknown } | null;
    const { error: storeError } = await supabase.rpc("store_ai_exchange", {
      p_language: selectedLanguage,
      p_context_content_id: contextContentId,
      p_question: question,
      p_answer: answer.answer,
      p_cited_content_ids: sources.map((source) => source.id),
      p_model_key: answer.model,
      p_prompt_version: answer.promptVersion,
      p_input_tokens: tokenValue(usage?.input_tokens),
      p_output_tokens: tokenValue(usage?.output_tokens),
    });
    if (storeError) console.error("ask_jalwa_history_store_failed", storeError.message);

    return NextResponse.json({
      answer: answer.answer,
      sources: sources.map((source, index) => ({ ...source, citation: index + 1, url: `/watch/${source.slug}` })),
      remainingTier: hasAiPlus ? "premium" : "free",
    });
  } catch (error) {
    console.error("ask_jalwa_failed", error);
    return NextResponse.json({ error: "Ask Jalwa is temporarily unavailable." }, { status: 503 });
  }
}
