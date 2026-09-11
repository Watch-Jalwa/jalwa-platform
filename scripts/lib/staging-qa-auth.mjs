const required = (name) => {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required staging QA setting: ${name}`);
  return value;
};

const retryableQaStatuses = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function qaConfig() {
  return {
    baseUrl: ((process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim() || required("STAGING_BASE_URL")).replace(/\/$/, ""),
    qaSecret: ((process.env.STAGING_QA_SECRET ?? process.env.JALWA_STAGING_QA_SECRET ?? "").trim() || required("STAGING_QA_SECRET")),
    qaRunId: (process.env.QA_RUN_ID ?? `qa-${Date.now()}`).slice(0, 160),
  };
}

async function qaPost(config, body) {
  const payload = JSON.stringify(body);
  let lastTransportError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${config.baseUrl}/api/internal/qa/session`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-jalwa-qa-token": config.qaSecret },
        body: payload,
        signal: AbortSignal.timeout(15_000),
      });
      if (!retryableQaStatuses.has(response.status) || attempt === 5) return response;
    } catch (error) {
      lastTransportError = error;
      if (attempt === 5) throw error;
    }

    await sleep(Math.min(2_000, 300 * (2 ** (attempt - 1))));
  }

  throw lastTransportError ?? new Error("Jalwa QA session request did not complete.");
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
  if (new URL(page.url()).pathname === "/login") throw new Error("Staging QA authentication did not create a session.");

  const deadline = Date.now() + 25_000;
  let lastStatus = 0;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const sessionProbe = await page.request.get(`${config.baseUrl}/api/auth/get-session`, {
        headers: { "Cache-Control": "no-store" },
      });
      lastStatus = sessionProbe.status();
      if (sessionProbe.ok()) {
        const payload = await sessionProbe.json().catch(() => null);
        if (payload?.user?.id) return;
      } else if (lastStatus !== 401 && lastStatus !== 429 && lastStatus < 500) {
        throw new Error(`authenticated session probe returned HTTP ${lastStatus}`);
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("authenticated session probe returned")) throw error;
    }
    await page.waitForTimeout(350);
  }

  const detail = lastError instanceof Error ? `; last transport error: ${lastError.message}` : "";
  throw new Error(`Staging QA authentication did not establish a browser session (last HTTP ${lastStatus || "none"}${detail}).`);
}
