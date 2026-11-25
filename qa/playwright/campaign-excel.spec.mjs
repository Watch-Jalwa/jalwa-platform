import {test,expect} from "@playwright/test";
import {authenticatePage,ensureQaUser,qaConfig} from "./helpers/staging.mjs";
import nodemailer from "nodemailer";
import {composeCampaignDailyDigest} from "../../apps/web/lib/reports/campaign-digest.mjs";
const config=qaConfig();
function filesFromXlsx(buffer) {
  const out=new Map();let offset=0;
  while(offset+30<=buffer.length && buffer.readUInt32LE(offset)===0x04034b50){
    const method=buffer.readUInt16LE(offset+8);
    expect(method).toBe(0);
    const length=buffer.readUInt32LE(offset+18);
    const fn=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28);
    const name=buffer.subarray(offset+30,offset+30+fn).toString();
    const start=offset+30+fn+extra;
    out.set(name,buffer.subarray(start,start+length).toString());
    offset=start+length;
  }
  return out;
}
test("staging admin report + downloaded Excel use identical filters, date-wise and Basic/Detailed totals",async({page})=>{
  const actor=await ensureQaUser(config,process.env.STAGING_QA_ADMIN_EMAIL,"admin");
  await authenticatePage(page,config,actor.email,"/studio/campaigns");
  const filters=new URLSearchParams({
    start:"2026-11-24",end:"2026-11-24",
    product:"jalwa",platform:"Meta",plan:"premium-monthly-pkr",
    parameter:"Ranchers",landing:"/landing1",referral:"qa-approval",campaign:"qa-excel",
  });
  const query=filters.toString();
  const reportResponse=await page.context().request.get("/api/studio/campaigns/report?"+query);
  expect(reportResponse.status()).toBe(200);
  const report=await reportResponse.json();
  expect(Number.isSafeInteger(report.totals.subs)).toBe(true);
  expect(report.dateWise.map(x=>x.subs).reduce((s,x)=>s+x,0)).toBe(report.totals.subs);
  for(const d of ["platform","plan","parameter"])
    expect(report.dimensions[d].reduce((s,x)=>s+x.subs,0)).toBe(report.totals.subs);
  const exportResponse=await page.context().request.get("/api/studio/campaigns/export?"+query);
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-type"]).toContain("spreadsheetml.sheet");
  const buffer=await exportResponse.body();
  expect(buffer.subarray(0,4).toString("hex")).toBe("504b0304");
  const parts=filesFromXlsx(buffer);
  expect(parts.size).toBe(7);
  const workbook=parts.get("xl/workbook.xml");
  const sheetA=parts.get("xl/worksheets/sheet1.xml");
  const sheetB=parts.get("xl/worksheets/sheet2.xml");
  expect(workbook).toContain('sheet name="Date-wise Subs"');
  expect(workbook).toContain('sheet name="Basic and Detailed"');
  for(const sheet of [sheetA,sheetB]){
    for(const key of ["Filter: Product","Filter: Platform","Filter: Plan ID",
      "Filter: Parameter / UTM","Filter: Landing Page","Filter: Referral","Filter: Campaign",
      "Meta","premium-monthly-pkr","Ranchers","qa-approval","qa-excel"])
      expect(sheet).toContain(key);
    expect(sheet).toContain("Verified Gross (minor units)");
  }
  expect(sheetA).toContain("Parameter / UTM");
  expect(sheetB).toContain("Platform-wise Subs");
  expect(sheetB).toContain("Plan ID-wise Subs");
  expect(sheetB).toContain("Parameter/UTM-wise Subs");
  expect(sheetA).toContain('<v>'+report.totals.subs+'</v>');
  expect(sheetB).toContain('<v>'+report.totals.subs+'</v>');
  await page.goto("/studio/campaigns?"+query,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Campaign Tracking & Analytics"})).toBeVisible();
  await expect(page.getByRole("link",{name:/Download Excel/})).toBeVisible();
});
test("non-finance staff cannot download campaign XLSX",async({page})=>{
  const actor=await ensureQaUser(config,process.env.STAGING_QA_RESTRICTED_EMAIL,"rights_reviewer");
  await authenticatePage(page,config,actor.email,"/studio");
  expect((await page.context().request.get("/api/studio/campaigns/export?start=2026-11-24&end=2026-11-24")).status()).toBe(403);
});

test("daily prior-day dashboard totals match a captured MIME email + Excel without sending to external recipients",async({page})=>{
  const actor=await ensureQaUser(config,process.env.STAGING_QA_ADMIN_EMAIL,"admin");
  await authenticatePage(page,config,actor.email,"/studio/campaigns/daily");
  const day="2026-11-23";
  const [dailyResponse,reportResponse]=await Promise.all([
    page.context().request.get("/api/studio/campaigns/daily?date="+day),
    page.context().request.get("/api/studio/campaigns/report?start="+day+"&end="+day),
  ]);
  expect(dailyResponse.status()).toBe(200);
  expect(reportResponse.status()).toBe(200);
  const daily=await dailyResponse.json(), report=await reportResponse.json();
  const digest=composeCampaignDailyDigest(daily,report,day);
  expect(digest.text).toContain("Backend verified JazzCash successes | "+daily.successCount);
  expect(digest.text).toContain("Backend JazzCash failures | "+daily.failureCount);
  expect(digest.text).toContain("Campaign report paid Subs | "+report.totals.subs);
  const exported=await page.context().request.get("/api/studio/campaigns/export?start="+day+"&end="+day);
  expect(exported.status()).toBe(200);
  const excel=await exported.body();
  expect(excel.subarray(0,4).toString("hex")).toBe("504b0304");
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true});
  const receipt=await transport.sendMail({
    from:"qa-only@example.invalid",to:"staging-sink@example.invalid",
    subject:digest.subject,text:digest.text,
    attachments:[{filename:digest.filename,content:excel,
      contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}],
  });
  expect(receipt.envelope.to).toEqual(["staging-sink@example.invalid"]);
  const mime=receipt.message.toString();
  expect(mime).toContain("Backend verified JazzCash successes");
  expect(mime).toContain("jalwa-campaign-"+day+".xlsx");
  expect(mime).not.toContain("03001234567");
});

test("staging admin can save and clear an inert daily email recipient/time without enabling delivery",async({page})=>{
  const actor=await ensureQaUser(config,process.env.STAGING_QA_ADMIN_EMAIL,"admin");
  await authenticatePage(page,config,actor.email,"/studio/campaigns/daily");
  await page.goto("/studio/campaigns/daily",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Automated daily email settings"})).toBeVisible();
  const form=page.locator('form').filter({has:page.locator('textarea[name="recipients"]')});
  try{
    await form.locator('textarea[name="recipients"]').fill("staging-sink@example.invalid");
    await form.locator('input[name="hour"]').fill("9");
    await form.locator('input[name="minute"]').fill("15");
    await form.locator('input[name="enabled"]').uncheck();
    await form.getByRole("button",{name:"Save schedule"}).click();
    await page.waitForURL(/saved=1/);
    await expect(page.locator('textarea[name="recipients"]')).toHaveValue("staging-sink@example.invalid");
    await expect(page.locator('input[name="enabled"]')).not.toBeChecked();
  }finally{
    await page.goto("/studio/campaigns/daily",{waitUntil:"domcontentloaded"});
    const restore=page.locator('form').filter({has:page.locator('textarea[name="recipients"]')});
    await restore.locator('textarea[name="recipients"]').fill("");
    await restore.locator('input[name="hour"]').fill("9");
    await restore.locator('input[name="minute"]').fill("0");
    await restore.locator('input[name="enabled"]').uncheck();
    await restore.getByRole("button",{name:"Save schedule"}).click();
    await page.waitForURL(/saved=1/);
  }
});
