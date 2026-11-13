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
  assert.match(actions, /stopPremiumForUser/);
  assert.doesNotMatch(actions, /redirect\("\/profile\?unsubscribed=1"\)/);

  const byMsisdn = await readFile(new URL("../lib/payments/unsubscribe-by-msisdn.mjs", import.meta.url), "utf8");
  assert.match(byMsisdn, /lookupPremiumByJazzcashMsisdn/);
  assert.match(byMsisdn, /unsubscribePremiumByJazzcashMsisdn/);
  assert.match(byMsisdn, /auto_renew_consented = false/);
  assert.match(byMsisdn, /USER_UNSUBSCRIBED/);
  assert.match(byMsisdn, /unlinkJazzcashWalletForUser/);

  const header = await readFile(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(header, /HeaderUnsubscribeButton/);

  const headerButton = await readFile(new URL("../components/header-unsubscribe-button.tsx", import.meta.url), "utf8");
  assert.match(headerButton, /Are you sure you want to cancel your subscription/);
  assert.match(headerButton, /Click Here to view plans/);
  assert.match(headerButton, /\/api\/v1\/premium\/billing\/unsubscribe\/lookup/);
  assert.match(headerButton, /\/api\/v1\/premium\/billing\/unsubscribe\/confirm/);

  const authPrompt = await readFile(new URL("../components/post-jazzcash-auth-prompt.tsx", import.meta.url), "utf8");
  assert.match(authPrompt, /Premium is ready/);
  assert.match(authPrompt, /Sign in/);
  assert.match(authPrompt, /Signup/);
  assert.match(authPrompt, /open && onHome/);
  assert.match(authPrompt, /dismissForAuth/);

  const billingActions = await readFile(new URL("../app/billing/actions.ts", import.meta.url), "utf8");
  assert.match(billingActions, /unlinkJazzcashWalletForUser/);
  assert.match(billingActions, /jazzcashV11Configured/);

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
