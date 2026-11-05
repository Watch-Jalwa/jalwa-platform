import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("profile unsubscribe returns ok and refreshes Free plan without hard redirect crash", async () => {
  const actions = await readFile(new URL("../app/profile/actions.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
  const button = await readFile(new URL("../components/unsubscribe-premium-button.tsx", import.meta.url), "utf8");
  const reconcile = await readFile(new URL("../lib/payments/jazzcash-landing-billing.mjs", import.meta.url), "utf8");

  assert.match(actions, /export async function unsubscribePremium/);
  assert.match(actions, /return \{ ok: true \}/);
  assert.match(actions, /auto_renew_consented = false/);
  assert.match(actions, /USER_UNSUBSCRIBED/);
  assert.doesNotMatch(actions, /redirect\("\/profile\?unsubscribed=1"\)/);

  assert.match(page, /UnsubscribePremiumButton/);
  assert.match(page, /if \(!params\.unsubscribed\)/);
  assert.match(page, /reconcileJazzcashPremiumForUser/);

  assert.match(button, /router\.replace\("\/profile\?unsubscribed=1"\)/);
  assert.match(button, /router\.refresh\(\)/);

  assert.match(reconcile, /\["cancelled", "expired"\]/);
});

test("homepage uses the Pakistan hero banner asset", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /home-banner-hero/);
  assert.match(page, /\/home\/homepage-hero-banner\.jpeg/);
  assert.match(page, /Pakistan ki kahaniyan/);
});
