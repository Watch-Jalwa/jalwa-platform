import test from "node:test";
import assert from "node:assert/strict";
import {campaignLink} from "../lib/landing/campaign-links.mjs";
import {normalizeLanding1Campaign} from "../lib/landing-campaign.mjs";
import {normalizePlatform} from "../lib/reports/campaign.mjs";
test("campaign link preserves source, referral, parameter and verified plan choice",()=>{
 const href=campaignLink({landing_path:"/landing1",plan_code:"premium-annual-pkr",
   source:"Meta",utm_campaign:"winter",parameter:"ranchers",referral:"partner123"});
 assert.ok(href.startsWith("/landing1?"));
 const u=new URL(href,"https://watch-jalwa.com");
 const c=normalizeLanding1Campaign(u.searchParams);
 assert.equal(c.planCode,"premium-annual-pkr");
 assert.equal(c.utm_source,"meta");
 assert.equal(c.ref,"partner123");
 assert.equal(c.parameter,"ranchers");
});
test("unsupported price is not silently coerced to monthly",()=>{
 assert.equal(campaignLink({landing_path:"/landing1",plan_code:"not-mapped",source:"TikTok"}),null);
});
test("Snapchat legacy S maps to Snapchat",()=>{
 assert.equal(normalizePlatform("S"),"Snapchat");
});
