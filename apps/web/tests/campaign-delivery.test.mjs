import test from "node:test";
import assert from "node:assert/strict";
import {dispatchDecision,allRecipientsAccepted,priorKarachiDate} from "../lib/reports/campaign-delivery.mjs";
const settings={enabled:true,timezone:"Asia/Karachi",delivery_hour:9,delivery_minute:0};
const due=new Date("2026-11-24T04:00:00Z");
test("PKT schedule and two consecutive reporting days, including leap day",()=>{
  assert.equal(dispatchDecision(new Date("2026-11-24T03:59:00Z"),settings,null),"scheduled_later");
  assert.equal(dispatchDecision(due,settings,null),"ready");
  assert.equal(dispatchDecision(new Date("2026-11-25T04:00:00Z"),settings,null),"ready");
  assert.equal(priorKarachiDate(new Date("2028-02-29T18:59:59Z")),"2028-02-28");
  assert.equal(priorKarachiDate(new Date("2028-02-29T19:00:00Z")),"2028-02-29");
  assert.equal(dispatchDecision(due,{...settings,enabled:false},null),"settings_disabled");
  assert.throws(()=>dispatchDecision(due,{...settings,delivery_hour:24},null));
});
test("duplicate, ambiguous submission and bounded pre-submission retry decisions",()=>{
  assert.equal(dispatchDecision(due,settings,{status:"sent",attempts:1}),"already_sent");
  assert.equal(dispatchDecision(due,settings,{status:"pending",attempts:1}),"in_progress_or_reconciliation_required");
  assert.equal(dispatchDecision(new Date("2026-11-24T23:00:00Z"),settings,{status:"pending",attempts:1}),"scheduled_later");
  assert.equal(dispatchDecision(new Date("2026-11-24T14:00:00Z"),settings,{status:"pending",attempts:1}),"in_progress_or_reconciliation_required");
  assert.equal(dispatchDecision(due,settings,{status:"failed",attempts:2}),"ready");
  assert.equal(dispatchDecision(due,settings,{status:"failed",attempts:3}),"retry_limit");
});
test("SMTP partial or missing acceptance cannot count as successful delivery",()=>{
  const recipients=["a@example.invalid","b@example.invalid"];
  assert.equal(allRecipientsAccepted(recipients,["a@example.invalid"],["b@example.invalid"]),false);
  assert.equal(allRecipientsAccepted(recipients,["a@example.invalid"],[]),false);
  assert.equal(allRecipientsAccepted(recipients,undefined,undefined),false);
  assert.equal(allRecipientsAccepted(recipients,["A@example.invalid","b@example.invalid"],[]),true);
});
