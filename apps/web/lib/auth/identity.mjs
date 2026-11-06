const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PK_MOBILE_RE = /^(?:\+?92|0)?3\d{9}$/;

export function normalizePakistaniMobile(raw) {
  const digits = String(raw ?? "").replace(/[\s()-]/g, "");
  if (!PK_MOBILE_RE.test(digits)) return null;
  const national = digits.replace(/^\+?92/, "").replace(/^0/, "");
  if (!/^3\d{9}$/.test(national)) return null;
  return `+92${national}`;
}

export function parseIdentity(raw) {
  const identity = String(raw ?? "").trim();
  if (!identity || identity.length > 254) return { ok: false, error: "invalid-identity" };

  if (identity.includes("@")) {
    const email = identity.toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid-email" };
    return { ok: true, channel: "email", identity: email, normalized: email };
  }

  const phone = normalizePakistaniMobile(identity);
  if (!phone) return { ok: false, error: "invalid-phone" };
  return { ok: true, channel: "phone", identity: phone, normalized: phone };
}

export function maskIdentity(channel, normalized) {
  if (channel === "email") {
    const [local, domain] = String(normalized).split("@");
    if (!local || !domain) return "***";
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
  }
  return `${normalized.slice(0, 4)}***${normalized.slice(-3)}`;
}

export function validateDisplayName(raw) {
  const name = String(raw ?? "").trim();
  if (name.length < 2 || name.length > 60) return null;
  return name;
}
