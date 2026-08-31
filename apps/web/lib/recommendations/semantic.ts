import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/database/admin";

const DIMENSIONS = 96;

function tokens(input: string) {
  const normalized = input.normalize("NFKC").toLocaleLowerCase("en").replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter((token) => token.length > 1);
  const chars = Array.from(normalized.replace(/\s/g, ""));
  const trigrams = chars.length < 3 ? [] : chars.slice(0,-2).map((_, index) => chars.slice(index,index+3).join(""));
  return [...words.flatMap((word) => [word, `w:${word}`]), ...trigrams.map((value) => `c:${value}`)];
}

export function deterministicEmbedding(input: string) {
  const vector = Array<number>(DIMENSIONS).fill(0);
  for (const token of tokens(input)) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt16BE(0) % DIMENSIONS;
    const sign = (digest[2] ?? 0) % 2 ? 1 : -1;
    const weight = 1 + (digest[3] ?? 0) / 255;
    vector[index] = (vector[index] ?? 0) + sign * weight;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value*value, 0)) || 1;
  return vector.map((value) => Number((value/norm).toFixed(8)));
}

export async function refreshSemanticRecommendations() {
  const database = createAdminClient();
  const { data: items, error } = await database.from("content_items").select("id,title_en,title_ur,description_en").eq("status", "published").limit(5000);
  if (error) throw error;
  let updated = 0;
  for (let index=0; index<(items ?? []).length; index+=100) {
    const rows = (items ?? []).slice(index,index+100).map((item) => {
      const text = [item.title_en,item.title_ur,item.description_en].filter(Boolean).join("\n");
      return { content_id: item.id, embedding: `[${deterministicEmbedding(text).join(",")}]`, model: "jalwa-hash-96-v1", source_hash: createHash("sha256").update(text).digest("hex"), refreshed_at: new Date().toISOString() };
    });
    if (!rows.length) continue;
    const { error: upsertError } = await database.from("content_embeddings").upsert(rows, { onConflict: "content_id" });
    if (upsertError) throw upsertError;
    updated += rows.length;
  }
  const [{ data: semantic, error: semanticError }, { data: behavioural, error: behaviouralError }] = await Promise.all([
    database.rpc("refresh_semantic_similarity", { p_limit_per_item: 20 }),
    database.rpc("refresh_recommendation_models"),
  ]);
  if (semanticError) throw semanticError;
  if (behaviouralError) throw behaviouralError;
  return { updated, semantic, behavioural, model: "jalwa-hash-96-v1" };
}
