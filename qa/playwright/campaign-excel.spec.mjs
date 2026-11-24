import {test,expect} from "@playwright/test";
import {authenticatePage,ensureQaUser,qaConfig} from "./helpers/staging.mjs";
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
