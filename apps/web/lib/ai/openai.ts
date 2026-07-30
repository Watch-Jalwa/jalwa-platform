import {
  buildSourceContext,
  extractChatCompletionText,
  hasHardSafetyRisk,
  parseModerationDecision,
  sanitizeSourceCitations,
} from "@/lib/ai/grounding.mjs";

export type GroundedSource = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  attribution?: string | null;
};

type AiProvider = "deepseek" | "openai" | "openai_compatible";

type ProviderConfig = {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

function providerConfig(): ProviderConfig {
  const providerValue = (process.env.AI_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : "openai")).toLowerCase();
  const provider: AiProvider = providerValue === "deepseek" || providerValue === "openai" ? providerValue : "openai_compatible";
  const apiKey = process.env.AI_API_KEY
    ?? (provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY)
    ?? "";
  if (!apiKey) throw new Error(`${provider} AI API key is not configured`);

  const baseUrl = (process.env.AI_BASE_URL
    ?? (provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1"))
    .replace(/\/+$/, "");
  const model = process.env.AI_MODEL
    ?? (provider === "deepseek" ? "deepseek-v4-flash" : process.env.OPENAI_MODEL ?? "gpt-5-mini");
  return { provider, apiKey, baseUrl, model };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function chatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  maxTokens?: number;
  json?: boolean;
}) {
  const config = providerConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({
      model: input.model ?? config.model,
      messages: input.messages,
      temperature: input.json ? 0 : 0.2,
      max_tokens: input.maxTokens ?? Number(process.env.AI_MAX_OUTPUT_TOKENS ?? process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 700),
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000)),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${config.provider} completion failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  return { config, payload, text: extractChatCompletionText(payload) };
}

async function openAiModeration(question: string) {
  const apiKey = process.env.OPENAI_MODERATION_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI moderation key is not configured");
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ model: "omni-moderation-latest", input: question }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Moderation failed: ${response.status}`);
  const payload = await response.json() as { results?: Array<{ flagged?: boolean }> };
  return Boolean(payload.results?.[0]?.flagged);
}

export async function moderateQuestion(question: string) {
  if (hasHardSafetyRisk(question)) return true;
  const mode = (process.env.AI_MODERATION_MODE ?? "provider").toLowerCase();
  if (mode === "local") return false;
  if (mode === "openai") return openAiModeration(question);

  const result = await chatCompletion({
    model: process.env.AI_MODERATION_MODEL,
    maxTokens: 100,
    json: true,
    messages: [
      {
        role: "system",
        content: "Classify a user request for a family-safe Pakistani content portal. Return JSON only: {\"blocked\":boolean}. Block actionable instructions for self-harm, sexual exploitation of minors, explosives or weapons, serious violent wrongdoing, or evading law enforcement. Do not block prevention, reporting, historical, religious, agricultural, health, or educational discussion merely because it mentions a sensitive topic.",
      },
      { role: "user", content: JSON.stringify({ request: question }) },
    ],
  });
  const decision = parseModerationDecision(result.text);
  if (decision === null) throw new Error("AI moderation returned an invalid decision");
  return decision;
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
  const result = await chatCompletion({
    messages: [
      {
        role: "system",
        content: [
          "You are Ask Jalwa, a Pakistan-focused content discovery assistant.",
          "Use only the approved Jalwa sources supplied in the request.",
          "Never invent facts, titles, links, religious rulings, medical diagnoses, pesticide instructions, or financial guarantees.",
          "When the sources are insufficient, say so plainly and recommend a relevant Jalwa category instead.",
          "Cite factual claims using source numbers like [1] or [2].",
          "For farming, health, religious, legal, or financial topics, state important limitations and encourage qualified local advice.",
          languageInstruction,
        ].join(" "),
      },
      {
        role: "user",
        content: `User question:\n${input.question}\n\nApproved Jalwa sources:\n${sourceContext || "No approved sources were found."}`,
      },
    ],
  });
  const answer = sanitizeSourceCitations(result.text, input.sources.length);
  if (!answer) throw new Error("AI provider returned an empty answer");
  const usage = result.payload.usage as { prompt_tokens?: unknown; completion_tokens?: unknown; input_tokens?: unknown; output_tokens?: unknown } | undefined;
  return {
    answer,
    model: `${result.config.provider}:${String(result.payload.model ?? result.config.model)}`,
    usage: {
      input_tokens: usage?.input_tokens ?? usage?.prompt_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? usage?.completion_tokens ?? 0,
    },
  };
}
