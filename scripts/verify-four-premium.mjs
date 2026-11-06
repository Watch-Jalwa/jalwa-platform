import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { generateMagicLink } from "./lib/staging-qa-auth.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.JALWA_PLAYWRIGHT_PATH || "@playwright/test");
const origins = ["https://jalwa-platform.codistan.org", "https://watch-jalwa.com"];
const allowed = ["spring-blender", "sprite-fright", "caminandes-llamigos", "apollo-11-eagle-has-landed", "cosmos-laundromat"];
const requested = process.argv.slice(2);
const slugs = requested.length ? [...new Set(requested)] : allowed;
const titles = new Map(readFileSync("content/live-test-50-launch-catalogue.jsonl", "utf8").trim().split("\n").map(line => {
  const row = JSON.parse(line);
  return [row.slug, row.titleEn];
}));
const sha = process.env.RELEASE_SHA;
const email = (process.env.PREMIUM_QA_EMAIL || process.env.STAGING_QA_CUSTOMER_EMAIL || "").trim().toLowerCase();
const qaSecret = process.env.STAGING_QA_SECRET;
const evidence = { release: sha, accounts: [], playback: [] };
const authOnly = process.env.PREMIUM_QA_MODE === "auth-only";
const stamp = () => new Date().toISOString();
let stage = "configuration";
let browser;
const requireThat = (condition, reason) => { if (!condition) throw new Error("QA: " + reason); };
function save() {
  if (process.env.PREMIUM_QA_EVIDENCE) writeFileSync(process.env.PREMIUM_QA_EVIDENCE, JSON.stringify(evidence, null, 2));
}

async function hasPremium(page, origin) {
  const res = await page.goto(origin + "/premium", { waitUntil: "domcontentloaded" });
  requireThat(res?.ok() && page.url() === origin + "/premium", "Premium page unavailable on requested host");
  for (const code of ["premium_catalogue", "enhanced_quality"]) {
    const card = page.locator('[data-benefit-code="' + code + '"]');
    requireThat(await card.count() === 1, "expected Premium benefit card missing");
    if (await card.getAttribute("data-benefit-state") !== "unlocked") return false;
  }
  return true;
}

async function signIn(ctx, origin) {
  const action = new URL(await generateMagicLink({ baseUrl: origin, qaSecret, qaRunId: "issue157-four" }, email, "/premium"));
  requireThat(origins.includes(action.origin) && action.pathname === "/api/auth/magic-link/verify", "unexpected QA link");
  // Each shared alias receives a fresh one-time token issued by its own staging QA endpoint.
  // Consume it on that alias so Better Auth sets its host-local cookie; never copy cookies.
  const verify = await ctx.request.get(origin + action.pathname + action.search, { maxRedirects: 0 });
  requireThat(verify.status() >= 200 && verify.status() < 400, "Better Auth verification HTTP " + verify.status());
  await checkIdentity(ctx, origin);
}

async function checkIdentity(ctx, origin) {
  const session = await ctx.request.get(origin + "/api/auth/get-session", { maxRedirects: 0 });
  requireThat(session.ok(), "Better Auth session HTTP " + session.status());
  const account = (await session.json())?.user;
  requireThat(account?.id && account.email?.toLowerCase() === email, "signed-in QA identity mismatch");
  const page = await ctx.newPage();
  try {
    requireThat(await hasPremium(page, origin), "QA viewer does not have active Premium");
    evidence.accounts.push({ origin, signedIn: true, premiumCatalogue: true, enhancedQuality: true, at: stamp() });
    save();
  } finally { await page.close(); }
}

async function check(ctx, origin, slug) {
  const page = await ctx.newPage();
  let phase = "watch page";
  let tokenStatus = null;
  let mediaOrigin = null;
  const transport = new Set();
  const mediaHits = [];
  try {
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/media/")) transport.add(url.origin + " " + response.status() + " " + (response.headers()["access-control-allow-origin"] || "no-cors-header"));
      if (!origins.includes(url.origin) || !response.ok()) return;
      if (url.pathname.startsWith("/api/media/processed/") && /\.(ts|m4s|mp4)$/i.test(url.pathname))
        mediaHits.push({ path: url.pathname, status: response.status() });
    });
    page.on("requestfailed", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/media/")) transport.add(url.origin + " " + (request.failure()?.errorText || "failed").slice(0,90));
    });
    const tokenPromise = page.waitForResponse(r => {
      const url = new URL(r.url());
      return url.origin === origin && /^\/api\/playback\/[\w-]+\/token$/.test(url.pathname) && r.request().method() === "POST";
    }, { timeout: 35000 }).catch(() => null);
    const url = origin + "/watch/" + slug;
    const res = await page.goto(url, { waitUntil: "domcontentloaded" });
    requireThat(res?.status() === 200 && page.url() === url, "watch page HTTP " + (res?.status() ?? 0));
    const title = titles.get(slug);
    requireThat((await page.locator("h1").first().innerText()).trim() === title, "wrong title");
    phase = "signed playback token";
    const token = await tokenPromise;
    tokenStatus = token?.status() ?? 0;
    requireThat(token?.ok(), "playback token HTTP " + tokenStatus);
    const id = new URL(token.url()).pathname.split("/")[3];
    const body = await token.json();
    const gate = new URL(body.url, origin);
    mediaOrigin = origins.includes(gate.origin) ? gate.origin : "unexpected origin";
    const prefix = "/api/media/processed/" + id + "/";
    requireThat(body.qualityTier === "enhanced" && body.delivery === "r2_gateway" && origins.includes(gate.origin) && gate.pathname.startsWith(prefix) && gate.searchParams.has("token"), "enhanced R2 playback authorization missing");
    phase = "15 seconds of decoded video";
    const video = page.locator('[data-testid="self-hosted-media-frame"] video');
    await video.waitFor({ state: "visible" });
    requireThat(await video.getAttribute("title") === title, "video title mismatch");
    const played = await video.evaluate(async v => {
      v.muted = true;
      const playback = async () => {
        await v.play();
        const decoded = () => {
          const stats = v.getVideoPlaybackQuality();
          return stats.totalVideoFrames - stats.droppedVideoFrames;
        };
        let start, frames, wall;
        const reset = () => { start = v.currentTime; frames = decoded(); wall = performance.now(); };
        reset();
        // The product may resume the QA viewer's saved position on the second host.
        v.addEventListener("seeking", reset);
        const deadline = performance.now() + 49000;
        while (performance.now() <= deadline) {
          if (v.error) return null;
          const advance = v.currentTime - start, newFrames = decoded() - frames;
          if (performance.now() - wall >= 15000 && advance >= 15 && newFrames >= 15 && !v.seeking && !v.paused && v.videoWidth && v.videoHeight) {
            return { seconds: Number(advance.toFixed(2)), decodedFrames: newFrames, width: v.videoWidth, height: v.videoHeight };
          }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        return null;
      };
      return await Promise.race([playback().catch(() => null), new Promise(resolve => setTimeout(() => resolve(null), 55000))]);
    });
    requireThat(played, "player did not decode and advance continuously for 15s");
    const hits = mediaHits.filter(x => x.path.startsWith(prefix));
    requireThat(hits.length, "no successful browser requests for this title's playable media");
    return { origin, slug, title, pass: true, tokenStatus, enhanced: true, mediaResponses: hits.length, ...played, at: stamp() };
  } catch (ex) {
    return { origin, slug, pass: false, phase, tokenStatus, mediaOrigin, mediaResponses: mediaHits.length, transport: [...transport], error: safeError(ex), at: stamp() };
  } finally { await page.close(); }
}

function safeError(error) {
  // Omit Playwright diagnostics: a URL in a browser exception can include a bearer token.
  return error?.message?.startsWith("QA: ") ? error.message.slice(4) : error?.message?.match(/^Jalwa QA magic-link generation failed with HTTP \d+\./)?.[0] || "operation failed or timed out";
}

try {
  requireThat(sha && /^[a-f0-9]{40}$/.test(sha) && email && qaSecret && slugs.every(s => allowed.includes(s) && titles.has(s)), "invalid SHA, QA settings or title selection");
  for (const origin of origins) {
    stage = "health " + origin;
    const res = await fetch(origin + "/api/health", { redirect: "error", signal: AbortSignal.timeout(20000) });
    const health = await res.json();
    requireThat(res.ok && health.service === "jalwa-web" && health.status === "ready" && health.version === sha, "deployed SHA or health mismatch");
  }
  browser = await chromium.launch({ headless: true });
  for (const origin of origins) {
    const statePath = process.env.QA_SESSION_DIR + "/" + new URL(origin).hostname + ".json";
    const ctx = await browser.newContext(authOnly ? {} : { storageState: statePath });
    try {
      stage = "QA sign-in and Premium " + origin;
      if (authOnly) {
        await signIn(ctx, origin);
        writeFileSync(statePath, JSON.stringify(await ctx.storageState()), { mode: 0o600 });
      } else {
        await checkIdentity(ctx, origin);
      }
      if (!authOnly) for (const slug of slugs) {
        const result = await check(ctx, origin, slug);
        evidence.playback.push(result);
        console.log(JSON.stringify(result));
        save();
      }
    } finally { await ctx.close(); }
  }
  requireThat(evidence.accounts.length === 2 && (authOnly || (evidence.playback.length === slugs.length * 2 && evidence.playback.every(row => row.pass))), "some browser checks failed");
  console.log(authOnly ? "Signed-in Premium proven on both hosts" : "Verified " + evidence.playback.length + " signed-in Premium playback cases");
} catch (ex) {
  evidence.failure = { stage, error: safeError(ex) };
  console.error(JSON.stringify(evidence.failure));
  process.exitCode = 1;
} finally {
  save();
  await browser?.close();
}
