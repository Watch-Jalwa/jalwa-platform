import type { ReactNode } from "react";

/** Gradient SVG icons for Made-for-Pakistan category tiles. */

function IconShell({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg className="category-icon-svg" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="55%" stopColor="#ff7a00" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export function CategoryIcon({ slug }: { slug: string }) {
  const g = `cat-grad-${slug}`;
  const stroke = `url(#${g})`;
  switch (slug) {
    case "originals":
      return (
        <IconShell id={g}>
          <rect x="10" y="12" width="28" height="22" rx="3" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M18 18h12M18 24h8M18 30h10" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <circle cx="34" cy="14" r="5" fill={stroke} />
          <path d="M32.8 14l2.4 1.4v-2.8z" fill="#1a0b2e" />
        </IconShell>
      );
    case "shorts":
      return (
        <IconShell id={g}>
          <circle cx="24" cy="24" r="14" fill="none" stroke={stroke} strokeWidth="2.2" />
          <circle cx="24" cy="24" r="4" fill={stroke} />
          <path d="M24 10v4M24 34v4M10 24h4M34 24h4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </IconShell>
      );
    case "entertainment":
      return (
        <IconShell id={g}>
          <path d="M16 18c0-4 3-7 8-7s8 3 8 7v16H16V18Z" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M16 34h16M20 18v16M28 18v16" stroke={stroke} strokeWidth="2" />
          <circle cx="20" cy="14" r="2" fill={stroke} />
          <circle cx="28" cy="14" r="2" fill={stroke} />
        </IconShell>
      );
    case "deen":
      return (
        <IconShell id={g}>
          <path d="M24 8l2 6h6l-5 4 2 6-5-3.5L19 24l2-6-5-4h6z" fill={stroke} opacity="0.35" />
          <path d="M12 36V22l12-8 12 8v14" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M20 36v-8h8v8M24 14v-4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="18" r="2" fill={stroke} />
        </IconShell>
      );
    case "kissan":
      return (
        <IconShell id={g}>
          <rect x="8" y="26" width="20" height="10" rx="2" fill="none" stroke={stroke} strokeWidth="2.2" />
          <circle cx="14" cy="36" r="4" fill="none" stroke={stroke} strokeWidth="2" />
          <circle cx="28" cy="36" r="4" fill="none" stroke={stroke} strokeWidth="2" />
          <path d="M28 28h8l4 6v2h-6" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M12 26V18h10v8" stroke={stroke} strokeWidth="2" />
        </IconShell>
      );
    case "learn":
      return (
        <IconShell id={g}>
          <path d="M8 14l16-6 16 6v20l-16 6-16-6V14Z" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M24 8v28M8 14l16 6 16-6" stroke={stroke} strokeWidth="2" />
        </IconShell>
      );
    case "tech":
      return (
        <IconShell id={g}>
          <rect x="12" y="12" width="24" height="24" rx="4" fill="none" stroke={stroke} strokeWidth="2.2" />
          <text x="24" y="28" textAnchor="middle" fill={stroke} fontSize="11" fontWeight="800" fontFamily="Segoe UI, sans-serif">
            AI
          </text>
          <path d="M24 8v4M24 36v4M8 24h4M36 24h4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </IconShell>
      );
    case "rozgar":
      return (
        <IconShell id={g}>
          <rect x="10" y="18" width="28" height="18" rx="3" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M18 18v-3a6 6 0 0 1 12 0v3" stroke={stroke} strokeWidth="2.2" fill="none" />
          <path d="M10 26h28" stroke={stroke} strokeWidth="2" />
        </IconShell>
      );
    case "pakistan":
      return (
        <IconShell id={g}>
          <path d="M6 36l10-16 6 8 8-14 12 22H6Z" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M22 28l4-6 6 10" stroke={stroke} strokeWidth="2" fill="none" />
        </IconShell>
      );
    case "kids":
      return (
        <IconShell id={g}>
          <circle cx="24" cy="14" r="5" fill={stroke} />
          <circle cx="12" cy="18" r="4" fill={stroke} opacity="0.75" />
          <circle cx="36" cy="18" r="4" fill={stroke} opacity="0.75" />
          <path d="M14 36c0-6 4.5-10 10-10s10 4 10 10" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M8 34c0-4 2.5-7 6-8M40 34c0-4-2.5-7-6-8" fill="none" stroke={stroke} strokeWidth="2" />
        </IconShell>
      );
    case "life":
      return (
        <IconShell id={g}>
          <path
            d="M24 38s-12-7.5-12-16a7 7 0 0 1 12-4 7 7 0 0 1 12 4c0 8.5-12 16-12 16Z"
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
          />
          <path d="M14 22h6l2-4 3 8 2-4h7" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </IconShell>
      );
    case "live":
      return (
        <IconShell id={g}>
          <circle cx="24" cy="24" r="5" fill={stroke} />
          <path d="M16 16a11 11 0 0 1 16 0M12 12a17 17 0 0 1 24 0" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M22 24l5 3v-6z" fill="#1a0b2e" />
        </IconShell>
      );
    default:
      return (
        <IconShell id={g}>
          <circle cx="24" cy="24" r="12" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M20 24l4 3 6-6" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
        </IconShell>
      );
  }
}
