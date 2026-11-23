/**
 * Branded catalogue posters generated in-app when no curated still exists.
 * Theme follows slug/category so cards look relevant, not generic title plates.
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

const THEMES = {
  static: {
    a: "#050505", b: "#1a1a1a", c: "#e5e5e5", ink: "#fafafa",
    motif: "static",
  },
  space: {
    a: "#050814", b: "#1e1b4b", c: "#fbbf24", ink: "#fffbeb",
    motif: "stars",
  },
  canyon: {
    a: "#1c0f0a", b: "#7c2d12", c: "#fdba74", ink: "#fff7ed",
    motif: "canyon",
  },
  nature: {
    a: "#052e16", b: "#14532d", c: "#86efac", ink: "#f0fdf4",
    motif: "leaves",
  },
  animation: {
    a: "#1a120c", b: "#3b1d0f", c: "#ff7a00", ink: "#fff7ed",
    motif: "orb",
  },
  learn: {
    a: "#0c1929", b: "#1e3a5f", c: "#38bdf8", ink: "#eff6ff",
    motif: "grid",
  },
  default: {
    a: "#14110e", b: "#2a1608", c: "#ff7a00", ink: "#fff7ed",
    motif: "orb",
  },
};

export function resolvePosterTheme(input = {}) {
  const hay = `${input.slug ?? ""} ${input.title ?? ""} ${input.category ?? ""} ${input.contentType ?? ""}`.toLowerCase();
  if (/vhs|static|analog|television|noise/.test(hay)) return THEMES.static;
  if (/apollo|nasa|iss|moon|space|orbit|earth view/.test(hay)) return THEMES.space;
  if (/canyon|grca|desert|rim|nps/.test(hay)) return THEMES.canyon;
  if (/spring|forest|animal|bird|nature|kissan|farm/.test(hay)) return THEMES.nature;
  if (/sintel|sprite|cosmos|caminandes|blender|bunny|elephant|animation|entertainment/.test(hay)) {
    return THEMES.animation;
  }
  if (/learn|science|tech|deen/.test(hay)) return THEMES.learn;
  return THEMES.default;
}

function motifMarkup(theme, seed) {
  if (theme.motif === "static") {
    const bars = Array.from({ length: 28 }, (_, i) => {
      const x = i * 30;
      const h = 40 + ((seed + i * 17) % 420);
      const o = 0.08 + ((seed + i) % 7) / 40;
      return `<rect x="${x}" y="${(seed + i * 13) % 80}" width="18" height="${h}" fill="${theme.ink}" fill-opacity="${o}"/>`;
    }).join("");
    return `<g>${bars}<rect width="800" height="500" fill="url(#scan)"/></g>`;
  }
  if (theme.motif === "stars") {
    const stars = Array.from({ length: 36 }, (_, i) => {
      const x = (seed * (i + 3) * 37) % 800;
      const y = (seed * (i + 5) * 53) % 500;
      const r = 1 + (i % 3);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${theme.ink}" fill-opacity="${0.35 + (i % 5) / 20}"/>`;
    }).join("");
    return `<g>${stars}<circle cx="640" cy="120" r="54" fill="${theme.c}" fill-opacity="0.85"/><circle cx="640" cy="120" r="70" fill="${theme.c}" fill-opacity="0.18"/></g>`;
  }
  if (theme.motif === "canyon") {
    return `<g>
      <path d="M0 500 L0 310 C120 250 180 360 280 300 C360 250 420 340 520 280 C620 220 700 310 800 250 L800 500 Z" fill="${theme.c}" fill-opacity="0.22"/>
      <path d="M0 500 L0 360 C140 300 220 390 340 330 C460 270 540 380 660 320 C740 280 780 340 800 300 L800 500 Z" fill="${theme.c}" fill-opacity="0.35"/>
      <path d="M0 500 L0 410 C160 370 260 450 400 400 C560 340 680 430 800 380 L800 500 Z" fill="${theme.b}"/>
    </g>`;
  }
  if (theme.motif === "leaves") {
    return `<g fill="${theme.c}" fill-opacity="0.28">
      <ellipse cx="660" cy="120" rx="90" ry="36" transform="rotate(-28 660 120)"/>
      <ellipse cx="720" cy="190" rx="70" ry="28" transform="rotate(18 720 190)"/>
      <ellipse cx="600" cy="210" rx="60" ry="24" transform="rotate(-12 600 210)"/>
      <path d="M520 80 C580 140 620 200 640 280" stroke="${theme.c}" stroke-opacity="0.45" stroke-width="6" fill="none"/>
    </g>`;
  }
  if (theme.motif === "grid") {
    return `<g stroke="${theme.ink}" stroke-opacity="0.12" stroke-width="1">
      ${Array.from({ length: 12 }, (_, i) => `<line x1="${60 + i * 60}" y1="0" x2="${60 + i * 60}" y2="500"/>`).join("")}
      ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${40 + i * 60}" x2="800" y2="${40 + i * 60}"/>`).join("")}
      <circle cx="680" cy="120" r="48" fill="${theme.c}" fill-opacity="0.25"/>
    </g>`;
  }
  return `<g>
    <circle cx="690" cy="90" r="74" fill="${theme.c}" fill-opacity="0.18"/>
    <circle cx="620" cy="180" r="40" fill="${theme.c}" fill-opacity="0.12"/>
    <path d="M520 500 C580 320 690 280 860 40" fill="none" stroke="${theme.c}" stroke-opacity="0.22" stroke-width="56"/>
  </g>`;
}

/**
 * Build a 16:10 SVG poster for catalogue cards and watch posters.
 */
export function buildGeneratedPosterSvg(input = {}) {
  const title = clampTitle(input.title);
  const category = String(input.category || input.contentType || "Jalwa").trim() || "Jalwa";
  const duration = formatDuration(input.durationSeconds);
  const theme = resolvePosterTheme(input);
  const safeTitle = escapeXml(title);
  const safeCategory = escapeXml(category.toUpperCase());
  const safeDuration = duration ? escapeXml(duration) : "";
  const seed = hashString(input.id || input.slug || title);
  const titleSize = title.length > 42 ? 34 : title.length > 28 ? 38 : 46;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.a}"/>
      <stop offset="55%" stop-color="${theme.b}"/>
      <stop offset="100%" stop-color="${theme.a}"/>
    </linearGradient>
    <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="#fff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="veil" x1="0" y1="0.35" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.a}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${theme.a}" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#bg)"/>
  ${motifMarkup(theme, seed)}
  <rect width="800" height="500" fill="url(#veil)"/>
  <text x="40" y="56" fill="${theme.c}" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="3.5">JALWA</text>
  <rect x="40" y="78" width="48" height="4" rx="2" fill="${theme.c}"/>
  <foreignObject x="40" y="150" width="640" height="200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:${theme.ink};font:800 ${titleSize}px/1.12 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;letter-spacing:-0.03em;text-shadow:0 10px 40px rgba(0,0,0,.45);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${safeTitle}</div>
  </foreignObject>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif">
    <rect x="40" y="420" rx="999" ry="999" width="${Math.min(240, 34 + category.length * 11)}" height="36" fill="rgba(0,0,0,0.45)" stroke="${theme.c}" stroke-opacity="0.55"/>
    <text x="58" y="444" fill="${theme.ink}" font-size="14" font-weight="700" letter-spacing="1.4">${safeCategory}</text>
    ${safeDuration ? `<text x="760" y="444" text-anchor="end" fill="${theme.ink}" fill-opacity="0.9" font-size="16" font-weight="700">${safeDuration}</text>` : ""}
  </g>
</svg>`;
}
