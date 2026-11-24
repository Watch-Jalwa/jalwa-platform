import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authenticatePage, ensureQaUser, qaConfig } from "./helpers/staging.mjs";

const config=qaConfig();
const adminEmail=(process.env.STAGING_QA_ADMIN_EMAIL??"").trim();
const financeEmail=(process.env.STAGING_QA_FINANCE_EMAIL??"").trim();
const rightsEmail=(process.env.STAGING_QA_RESTRICTED_EMAIL??"").trim();
const viewerEmail=(process.env.STAGING_QA_UNAUTHORIZED_EMAIL??"").trim();
const qaCampaign="QA-Campaign-Admin-"+(process.env.QA_RUN_ID??"test").replace(/[^a-z0-9-]/gi,"").slice(0,48);
let admin,finance,rights,viewer;
const paths=["/studio/campaigns","/studio/campaigns/manage","/studio/campaigns/daily"];
const requestPaths=["/api/studio/campaigns/report","/api/studio/campaigns/daily","/api/studio/campaigns/export"];
async function roleSession(page,email) {
  await page.context().clearCookies();
  await authenticatePage(page,config,email,"/studio/campaigns");
}
test.describe.serial("Jalwa staging campaign admin role and workflow QA",()=>{
  test.beforeAll(async()=>{
    admin=await ensureQaUser(config,adminEmail,"admin");
    finance=await ensureQaUser(config,financeEmail,"finance");
    rights=await ensureQaUser(config,rightsEmail,"rights_reviewer");
    viewer=await ensureQaUser(config,viewerEmail,"viewer");
    expect(admin.id).toBeTruthy();
  });

  test("admin email/password form renders and bad credentials cannot sign in",async({page})=>{
    const r=await page.goto("/admin-login",{waitUntil:"domcontentloaded"});
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading",{name:"Staff sign in"})).toBeVisible();
    await expect(page.getByLabel("Staff email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.getByLabel("Staff email").fill("not-a-staff-account@example.invalid");
    await page.getByLabel("Password").fill("IncorrectPassword-123!");
    await page.getByRole("button",{name:/Sign in to Studio/}).click();
    // A rate-limited or unknown identity must never acquire a privileged session.
    await expect(page).toHaveURL(/\/admin-login(?:\?|$)/);
    expect((await page.context().request.get("/api/studio/campaigns/report")).status()).toBe(401);
  });

  test("anonymous cannot access campaign Studio routes or data APIs",async({page})=>{
    for(const path of paths){
      await page.goto(path,{waitUntil:"domcontentloaded"});
      expect(new URL(page.url()).pathname).toBe("/login");
    }
    for(const path of requestPaths){
      expect((await page.context().request.get(path)).status()).toBe(401);
    }
  });

  test("forged URL order and unauthorized scheduler cannot trigger a conversion or digest",async({page})=>{
    await page.context().clearCookies();
    const receipt=await page.context().request.post("/api/campaign/conversion-receipt",{data:{orderId:"forged-subscription-123"}});
    expect(receipt.status()).toBe(403);
    expect((await receipt.json()).verified).toBe(false);
    for(const path of ["/api/cron/campaign-daily","/api/cron/campaign-ga4"]){
      const response=await page.context().request.post(path,{headers:{authorization:"Bearer unauthorized-test-only"}});
      expect([401,403]).toContain(response.status());
    }
  });

  test("admin can view campaign overview and daily logs without server errors",async({page})=>{
    await roleSession(page,admin.email);
    for(const [path,heading] of [
      ["/studio/campaigns","Campaign Tracking & Analytics"],
      ["/studio/campaigns/manage","Campaign Management"],
      ["/studio/campaigns/daily","Daily JazzCash Logs"],
    ]){
      const r=await page.goto(path,{waitUntil:"domcontentloaded"});
      expect(r?.status(),path).toBe(200);
      await expect(page.getByRole("heading",{name:heading})).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Campaign analytics module is disabled|Campaign reporting is disabled|Campaign config migration.*unavailable/i);
    }
    const report=await page.context().request.get(requestPaths[0]);
    expect(report.status()).toBe(200);
    const payload=await report.json();
    expect(Number.isSafeInteger(payload?.totals?.subs)).toBe(true);
    expect(["platform","plan","parameter"].every(key=>Array.isArray(payload.dimensions[key]))).toBe(true);
    const daily=await page.context().request.get(requestPaths[1]);
    expect(daily.status()).toBe(200);
    const d=await daily.json();
    expect(Number.isInteger(d.landingViews)).toBe(true);
    expect(d.timezone).toBe("Asia/Karachi");
  });

  test("admin creates a disabled test campaign and can activate and deactivate",async({page})=>{
    await roleSession(page,admin.email);
    await page.goto("/studio/campaigns/manage",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"Create campaign"})).toBeVisible();
    const plan=page.locator('select[name="plan_code"] option').first();
    const firstPlan=await plan.getAttribute("value");
    expect(firstPlan,"Active price is needed to test campaign create").toBeTruthy();
    await page.locator('input[name="name"]').fill(qaCampaign);
    await page.locator('input[name="landing_path"]').fill("/mainLanding");
    await page.locator('select[name="source"]').selectOption("Meta");
    await page.locator('select[name="plan_code"]').selectOption(firstPlan);
    await page.locator('input[name="utm_campaign"]').fill("qa-stage-admin");
    await page.locator('input[name="parameter"]').fill("Ranchers");
    await page.locator('input[name="referral"]').fill("qa-only");
    await page.getByRole("button",{name:"Create disabled campaign"}).click();
    await expect(page.getByRole("cell",{name:qaCampaign,exact:true})).toBeVisible();
    const row=page.getByRole("row").filter({has:page.getByRole("cell",{name:qaCampaign,exact:true})});
    await expect(row).toContainText("Disabled");
    await row.getByRole("button",{name:"Activate"}).click();
    await expect(page.getByRole("row").filter({hasText:qaCampaign})).toContainText("Active");
    const activated=page.getByRole("row").filter({hasText:qaCampaign});
    await activated.getByRole("button",{name:"Disable"}).click();
    await expect(page.getByRole("row").filter({hasText:qaCampaign})).toContainText("Disabled");
  });

  test("finance can view reports but is denied campaign creation controls",async({page})=>{
    await roleSession(page,finance.email);
    const r=await page.goto("/studio/campaigns",{waitUntil:"domcontentloaded"});
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading",{name:"Campaign Tracking & Analytics"})).toBeVisible();
    expect((await page.context().request.get(requestPaths[0])).status()).toBe(200);
    await page.goto("/studio/campaigns/manage",{waitUntil:"domcontentloaded"});
    await expect(page.locator("body")).toContainText("Permission denied");
    await expect(page.getByRole("button",{name:"Create disabled campaign"})).toHaveCount(0);
  });

  test("rights reviewer and viewer cannot read campaign financial APIs",async({page})=>{
    await roleSession(page,rights.email);
    expect((await page.context().request.get(requestPaths[0])).status()).toBe(403);
    expect((await page.context().request.get(requestPaths[2])).status()).toBe(403);
    await page.goto("/studio/campaigns",{waitUntil:"domcontentloaded"});
    await expect(page.locator("body")).toContainText("Permission denied");
    await roleSession(page,viewer.email);
    for(const path of requestPaths)expect((await page.context().request.get(path)).status()).toBe(403);
    await page.goto("/studio/campaigns",{waitUntil:"domcontentloaded"});
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("invalid dashboard date range fails safely",async({page})=>{
    await roleSession(page,admin.email);
    const r=await page.context().request.get("/api/studio/campaigns/report?start=2026-11-25&end=2026-11-24");
    expect(r.status()).toBe(400);
    const e=await r.json();
    expect(e.error).toMatch(/Invalid/);
  });
  test("email/password succeeds only after protected admin role provisioning",async({page})=>{
    const email=(process.env.CAMPAIGN_QA_PASSWORD_EMAIL??"").trim().toLowerCase();
    expect(email).toMatch(/^campaign-admin-qa-[0-9]+@watch-jalwa\.com$/);
    const password="QASafe-"+randomBytes(20).toString("hex")+"!";
    const signup=await page.context().request.post("/api/auth/sign-up/email",{
      data:{name:"Campaign Staging QA",email,password},
    });
    expect(signup.status(),"Temporary email/password registration").toBe(200);
    // A new account must not self-assign any Studio role.
    await page.goto("/studio",{waitUntil:"domcontentloaded"});
    expect(new URL(page.url()).pathname).not.toBe("/studio");
    const authorized=await fetch(config.baseUrl+"/api/internal/qa/session",{
      method:"POST",
      headers:{"content-type":"application/json","x-jalwa-qa-token":config.qaSecret},
      body:JSON.stringify({email,role:"admin",issueLink:false}),
    });
    expect(authorized.status,"Protected QA role assignment").toBe(200);
    await page.context().clearCookies();
    // Test the real browser credential flow once; avoid consuming extra auth rate-limit budget.
    await page.goto("/admin-login",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("button",{name:/Sign in to Studio/})).toBeEnabled();
    await page.getByLabel("Staff email").fill(email);
    await page.getByLabel("Password").fill(password);
    const signInResponse=page.waitForResponse(response=>response.url().includes("/api/auth/sign-in/email"),{timeout:15000});
    await page.getByRole("button",{name:/Sign in to Studio/}).click();
    const authHttp=await signInResponse;
    const requestBody=authHttp.request().postDataJSON();
    expect(requestBody.email===email,"Browser submitted the typed staff email").toBe(true);
    const authBody=await authHttp.json().catch(()=>({}));
    expect(authHttp.status(),"Browser email/password authentication HTTP response: "+
      String(authBody.code??authBody.message??"no error code")).toBe(200);
    try{
      await expect.poll(()=>new URL(page.url()).pathname,{timeout:10000}).toBe("/studio");
    }catch{
      const session=await page.context().request.get("/api/auth/get-session");
      const json=await session.json().catch(()=>({}));
      const alert=await page.locator(".policy-notice[role=alert]").allTextContents();
      throw new Error("Login client navigation failed: path="+new URL(page.url()).pathname+
        " sessionHTTP="+session.status()+" hasSession="+Boolean(json?.user?.id)+
        " alert="+alert.join("|"));
    }
    const report=await page.context().request.get("/api/studio/campaigns/report");
    expect(report.status()).toBe(200);
    await page.goto("/studio/campaigns/manage",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"Campaign Management"})).toBeVisible();
  });

});
