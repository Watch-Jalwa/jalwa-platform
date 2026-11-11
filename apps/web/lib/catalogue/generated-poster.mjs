/**
 * Branded catalogue posters generated in-app (not extracted from video frames).
 * Deterministic palette per content id so cards stay stable across refreshes.
 */

function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clampTitle(title) {
  const cleaned = String(title ?? "Jalwa").trim() || "Jalwa";
  return cleaned.length > 64 ? `${cleaned.slice(0, 61)}…` : cleaned;
}

function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
  }
  if (mins <= 0) return `${secs}s`;
  return secs ? `${mins}m ${secs}s` : `${mins} min`;
}

/** Warm Jalwa-adjacent palettes — avoid flat purple/cream AI defaults. */
const PALETTES = [
  { a: "#1a120c", b: "#3b1d0f", c: "#ff7a00", ink: "#fff7ed" },
  { a: "#0f1714", b: "#1d3a32", c: "#34d399", ink: "#ecfdf5" },
  { a: "#12131a", b: "#243b55", c: "#38bdf8", ink: "#eff6ff" },
  { a: "#1a1014", b: "#4a1830", c: "#fb7185", ink: "#fff1f2" },
  { a: "#10140f", b: "#2f3b16", c: "#a3e635", ink: "#f7fee7" },
  { a: "#141018", b: "#2e1f4d", c: "#c4b5fd", ink: "#f5f3ff" },
  { a: "#16120a", b: "#4a3508", c: "#fbbf24", ink: "#fffbeb" },
  { a: "#0e1518", b: "#164e63", c: "#22d3ee", ink: "#ecfeff" },
];

export function posterPaletteForId(contentId) {
  const idx = hashString(contentId) % PALETTES.length;
  return PALETTES[idx];
}

/**
 * Build a 16:10 SVG poster for catalogue cards and watch posters.
 */
export function buildGeneratedPosterSvg(input = {}) {
  const title = clampTitle(input.title);
  const category = String(input.category || input.contentType || "Jalwa").trim() || "Jalwa";
  const duration = formatDuration(input.durationSeconds);
  const palette = posterPaletteForId(input.id || title);
  const safeTitle = escapeXml(title);
  const safeCategory = escapeXml(category.toUpperCase());
  const safeDuration = duration ? escapeXml(duration) : "";
  const seed = hashString(input.id || title);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.a}"/>
      <stop offset="55%" stop-color="${palette.b}"/>
      <stop offset="100%" stop-color="${palette.a}"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="18%" r="45%">
      <stop offset="0%" stop-color="${palette.c}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${palette.c}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grain" width="48" height="48" patternUnits="userSpaceOnUse">
      <circle cx="${8 + (seed % 7)}" cy="${10 + (seed % 5)}" r="1.2" fill="${palette.ink}" fill-opacity="0.08"/>
      <circle cx="${28 + (seed % 9)}" cy="${30 + (seed % 6)}" r="1" fill="${palette.ink}" fill-opacity="0.06"/>
      <circle cx="${40 + (seed % 4)}" cy="${14 + (seed % 8)}" r="1.1" fill="${palette.c}" fill-opacity="0.1"/>
    </pattern>
  </defs>
  <rect width="800" height="500" fill="url(#bg)"/>
  <rect width="800" height="500" fill="url(#glow)"/>
  <rect width="800" height="500" fill="url(#grain)"/>
  <path d="M520 500 C580 320 690 280 860 40" fill="none" stroke="${palette.c}" stroke-opacity="0.22" stroke-width="56"/>
  <path d="M-40 420 C180 360 260 220 420 -20" fill="none" stroke="${palette.ink}" stroke-opacity="0.08" stroke-width="40"/>
  <circle cx="690" cy="90" r="74" fill="${palette.c}" fill-opacity="0.16"/>
  <text x="40" y="58" fill="${palette.c}" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="3.5">JALWA</text>
  <rect x="40" y="84" width="56" height="4" rx="2" fill="${palette.c}"/>
  <foreignObject x="40" y="150" width="620" height="200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:${palette.ink};font:800 44px/1.12 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;letter-spacing:-0.03em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${safeTitle}</div>
  </foreignObject>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif">
    <rect x="40" y="420" rx="999" ry="999" width="${Math.min(220, 28 + category.length * 11)}" height="36" fill="rgba(0,0,0,0.38)" stroke="${palette.c}" stroke-opacity="0.45"/>
    <text x="58" y="444" fill="${palette.ink}" font-size="14" font-weight="700" letter-spacing="1.4">${safeCategory}</text>
    ${safeDuration ? `<text x="760" y="444" text-anchor="end" fill="${palette.ink}" fill-opacity="0.85" font-size="16" font-weight="700">${safeDuration}</text>` : ""}
  </g>
</svg>`;
}
