import test from "node:test";
import assert from "node:assert/strict";
import { karachiBounds, karachiDay, normalizePlatform, buildCampaignReport, buildDailyEventCounts } from "../lib/reports/campaign.mjs";

const verified = (id, overrides={}) => ({
  provider: "jazzcash", remotePaymentId: id, status: "completed", verified: true, hasSubscription: true,
  completedAt: "2026-11-23T19:15:00.000Z", amountMinor: 99000, product: "jalwa",
  source: "M", planCode: "premium-monthly-pkr", parameter: "Ranchers",
  landingPath: "/landing1", referral: "partner123", campaign: "launch", ...overrides,
});
test("Pakistan date boundaries include UTC previous-day evening", () => {
  assert.equal(karachiDay("2026-11-23T19:30:00.000Z"),"2026-11-24");
  assert.deepEqual(karachiBounds("2026-11-24","2026-11-24"),{
    startInclusiveUtc:"2026-11-23T19:00:00.000Z",endExclusiveUtc:"2026-11-24T19:00:00.000Z",
  });
});
test("legacy platform sources normalized without guessing", () => {
  assert.equal(normalizePlatform("M"),"Meta");
  assert.equal(normalizePlatform("T"),"TikTok");
  assert.equal(normalizePlatform("Snap"),"Snapchat");
  assert.equal(normalizePlatform("new-channel"),"Unknown");
});
test("dedupe verified provider payments, exclude failed and pending", () => {
  const r=buildCampaignReport([
    verified("A"),verified("A"),verified("B",{status:"failed"}),
    verified("C",{status:"pending"}),verified("D",{hasSubscription:false}),
    verified("E",{source:"T",planCode:"premium-annual-pkr",parameter:"Bike",amountMinor:299900}),
  ]);
  assert.equal(r.totals.subs,2);
  assert.equal(r.totals.revenueMinor,398900);
  assert.equal(r.dimensions.platform.reduce((s,x)=>s+x.subs,0),2);
  assert.equal(r.dimensions.plan.reduce((s,x)=>s+x.subs,0),2);
  assert.equal(r.dimensions.parameter.reduce((s,x)=>s+x.subs,0),2);
  assert.equal(r.dateWise[0].subs,2);
});
test("filters apply to all breakdowns and preserve exact PKT day", () => {
  const r=buildCampaignReport([
    verified("1",{source:"M"}),verified("2",{source:"T"}),verified("3",{source:"M",completedAt:"2026-11-23T18:58:00.000Z"}),
  ],{platform:"Meta",start:"2026-11-24",end:"2026-11-24"});
  assert.equal(r.totals.subs,1);
  assert.deepEqual(r.dimensions.platform,[{label:"Meta",subs:1}]);
});
test("HE and MPIN unknown are not falsely reported as zero", () => {
  const d=buildDailyEventCounts([
    {eventName:"landing_view",occurredAt:"2026-11-24T10:00:00Z",anonymousId:"a"},
    {eventName:"landing_view",occurredAt:"2026-11-24T11:00:00Z",anonymousId:"a"},
    {eventName:"begin_checkout",occurredAt:"2026-11-24T11:01:00Z",sessionId:"s1"},
  ],"2026-11-24");
  assert.equal(d.landingViews,2);
  assert.equal(d.uniqueLandingVisitors,1);
  assert.equal(d.mpinCount,null);
  assert.equal(d.heTraffic,null);
  assert.equal(d.nonHeTraffic,null);
  assert.equal(d.unknownHeTraffic,2);
});
test("reject invalid calendar date and reversed ranges", () => {
  assert.throws(()=>karachiBounds("2026-02-30","2026-03-01"));
  assert.throws(()=>karachiBounds("2026-11-25","2026-11-24"));
});
