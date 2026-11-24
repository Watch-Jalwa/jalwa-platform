import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createConversionReceipt,verifyConversionReceipt} from "../lib/reports/campaign-conversion-receipt.mjs";
const secret="test-only-long-secret-123456789";
test("conversion receipt authenticates verified order and plan; forged, mismatched, or expired receipts fail",()=>{
  const now=1000000,order="subscription-123",plan="premium-monthly-pkr";
  const token=createConversionReceipt(order,plan,secret,now);
  assert.deepEqual(verifyConversionReceipt(token,order,secret,now),{verified:true,orderId:order,planCode:plan});
  assert.equal(verifyConversionReceipt(token,"subscription-456",secret,now),null);
  assert.equal(verifyConversionReceipt(token+"x",order,secret,now),null);
  assert.equal(verifyConversionReceipt(token,order,secret,now+600000),null);
  assert.equal(verifyConversionReceipt(token,order,"wrong-secret-123456789012345",now),null);
  assert.equal(createConversionReceipt(order,plan,"short",now),null);
});
test("payment return uses a server receipt and wallet linking alone cannot fire Subscribe",async()=>{
  const callback=await readFile(new URL("../app/callback/route.ts",import.meta.url),"utf8");
  const prompt=await readFile(new URL("../components/post-jazzcash-auth-prompt.tsx",import.meta.url),"utf8");
  assert.match(callback,/result\.ok \? String\(result\.subscriptionId \?\? ""\)/);
  assert.match(prompt,/receipt\?\.verified/);
  assert.match(prompt,/campaignConsentGranted\(\)/);
  assert.doesNotMatch(callback,/result\.subscriptionId \?\? result\.requestId/);
});
test("attribution stays immutable and never transfers to a different account",async()=>{
  const route=await readFile(new URL("../app/api/campaign/event/route.ts",import.meta.url),"utf8");
  const billing=await readFile(new URL("../lib/payments/jazzcash-landing-billing.mjs",import.meta.url),"utf8");
  assert.match(route,/campaign_attributions\.expires_at>now\(\)/);
  assert.match(route,/campaign_attributions\.user_id=excluded\.user_id/);
  assert.doesNotMatch(route,/first_seen_at=case/);
  assert.match(billing,/a\.user_id is null or a\.user_id=\$3::uuid/);
  assert.match(billing,/i\.campaign_attribution_id is null/);
});
