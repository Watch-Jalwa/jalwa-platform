const STOP_WORDS = new Set([
  "the","a","an","and","or","to","for","of","in","on","is","are","was","were","be","with","about","how","what","where","when","why",
  "mujhe","mera","meri","mere","ka","ki","ke","ko","se","mein","main","kya","kaise","hain","hai","aur","par","liye"
]);

export function buildRetrievalQuery(question) {
  if (typeof question !== "string") return "";
  const words = question
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
  return [...new Set(words)].slice(0, 8).join(" ");
}

export function extractResponseText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

export function sanitizeSourceCitations(text, sourceCount) {
  if (typeof text !== "string") return "";
  return text.replace(/\[(\d+)\]/g, (match, value) => {
    const index = Number(value);
    return index >= 1 && index <= sourceCount ? match : "";
  }).trim();
}

export function buildSourceContext(sources) {
  return sources.map((source, index) => {
    const details = [
      `[${index + 1}] ${source.title}`,
      source.description ? `Summary: ${source.description}` : null,
      source.category ? `Category: ${source.category}` : null,
      source.language ? `Language: ${source.language}` : null,
      source.attribution ? `Attribution: ${source.attribution}` : null,
      `Jalwa URL: /watch/${source.slug}`,
    ].filter(Boolean);
    return details.join("\n");
  }).join("\n\n");
}
