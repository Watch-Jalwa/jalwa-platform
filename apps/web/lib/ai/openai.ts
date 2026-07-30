import { buildSourceContext, extractResponseText, sanitizeSourceCitations } from "@/lib/ai/grounding.mjs";

export type GroundedSource = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  attribution?: string | null;
};

function apiHeaders() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function moderateQuestion(question: string) {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ model: "omni-moderation-latest", input: question }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Moderation failed: ${response.status}`);
  const payload = await response.json() as { results?: Array<{ flagged?: boolean }> };
  return Boolean(payload.results?.[0]?.flagged);
}

export async function createGroundedAnswer(input: {
  question: string;
  language: "en" | "ur" | "roman_ur";
  sources: GroundedSource[];
}) {
  const languageInstruction = input.language === "ur"
    ? "Answer in clear Urdu script."
    : input.language === "roman_ur"
      ? "Answer in natural Roman Urdu."
      : "Answer in clear English.";
  const sourceContext = buildSourceContext(input.sources);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      store: false,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 700),
      instructions: [
        "You are Ask Jalwa, a Pakistan-focused content discovery assistant.",
        "Use only the approved Jalwa sources supplied in the request.",
        "Never invent facts, titles, links, religious rulings, medical diagnoses, pesticide instructions, or financial guarantees.",
        "When the sources are insufficient, say so plainly and recommend a relevant Jalwa category instead.",
        "Cite factual claims using source numbers like [1] or [2].",
        "For farming, health, religious, legal, or financial topics, state important limitations and encourage qualified local advice.",
        languageInstruction,
      ].join(" "),
      input: `User question:\n${input.question}\n\nApproved Jalwa sources:\n${sourceContext || "No approved sources were found."}`,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI response failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const payload = await response.json();
  const answer = sanitizeSourceCitations(extractResponseText(payload), input.sources.length);
  if (!answer) throw new Error("OpenAI returned an empty answer");
  return {
    answer,
    model: typeof payload.model === "string" ? payload.model : process.env.OPENAI_MODEL ?? "gpt-5-mini",
    usage: payload.usage ?? null,
  };
}
