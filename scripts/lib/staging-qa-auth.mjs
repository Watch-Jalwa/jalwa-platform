const required = (name) => {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required staging QA setting: ${name}`);
  return value;
};

export function qaConfig() {
  return {
    baseUrl: ((process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim() || required("STAGING_BASE_URL")).replace(/\/$/, ""),
    qaSecret: ((process.env.STAGING_QA_SECRET ?? process.env.JALWA_STAGING_QA_SECRET ?? "").trim() || required("STAGING_QA_SECRET")),
    qaRunId: (process.env.QA_RUN_ID ?? `qa-${Date.now()}`).slice(0, 160),
  };
}

async function qaPost(config, body) {
  return fetch(`${config.baseUrl}/api/internal/qa/session`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-jalwa-qa-token": config.qaSecret },
    body: JSON.stringify(body),
  });
}

export async function ensureQaUser(config, email, role = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Invalid staging QA email address.");
  const response = await qaPost(config, { email: normalizedEmail, role, issueLink: false, qaRunId: config.qaRunId });
  if (!response.ok) throw new Error(`Jalwa QA identity setup failed with HTTP ${response.status}.`);
  const payload = await response.json();
  if (!payload?.user?.id) throw new Error("Jalwa QA user ID was not returned.");
  return payload.user;
}

export async function generateMagicLink(config, email, nextPath = "/") {
  const response = await qaPost(config, { email: email.trim().toLowerCase(), nextPath, qaRunId: `${config.qaRunId}-${crypto.randomUUID()}` });
  if (!response.ok) throw new Error(`Jalwa QA magic-link generation failed with HTTP ${response.status}.`);
  const payload = await response.json();
  if (!payload?.actionLink || !/^https?:\/\//.test(payload.actionLink)) throw new Error("Jalwa QA magic link was not returned.");
  return payload.actionLink;
}

export async function authenticatePage(page, config, email, nextPath = "/") {
  const actionLink = await generateMagicLink(config, email, nextPath);
  const response = await page.goto(actionLink, { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 500) throw new Error("Staging QA authentication navigation failed.");
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/login") throw new Error("Staging QA authentication did not create a session.");
}
