import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {buildCampaignReport} from "../lib/reports/campaign.mjs";
import {generateCampaignXlsx} from "../lib/reports/campaign-xlsx.mjs";
import {composeCampaignDailyDigest} from "../lib/reports/campaign-digest.mjs";

function fixture(id,source,plan,parameter,date,amount=99000,other={}) {
  return {provider:"jazzcash",remotePaymentId:id,status:"completed",verified:true,hasSubscription:true,
    completedAt:date,amountMinor:amount,product:"jalwa",source,planCode:plan,
    parameter,landingPath:"/landing1",referral:"partner123",campaign:"launch-2026",...other};
}
function unpackStored(buffer) {
  const files=new Map();
  let i=0;
  while(i+30<=buffer.length && buffer.readUInt32LE(i)===0x04034b50) {
    assert.equal(buffer.readUInt16LE(i+8),0);
    const length=buffer.readUInt32LE(i+18), n=buffer.readUInt16LE(i+26),
      extra=buffer.readUInt16LE(i+28);
    const name=buffer.subarray(i+30,i+30+n).toString();
    const start=i+30+n+extra;
    files.set(name,buffer.subarray(start,start+length).toString());
    i=start+length;
  }
  return files;
}
const rows=[
  fixture("1","M","premium-monthly-pkr","Ranchers","2026-11-23T19:30:00Z"),
  fixture("2","T","premium-annual-pkr","Bike","2026-11-24T09:00:00Z",299900),
  fixture("3","S","premium-monthly-pkr","KFC","2026-11-24T10:00:00Z"),
  fixture("4","Google","premium-monthly-pkr","Ranchers","2026-11-25T10:00:00Z"),
  fixture("4","Google","premium-monthly-pkr","Ranchers","2026-11-25T10:00:00Z"), // replay
  fixture("failed","M","premium-monthly-pkr","Ranchers","2026-11-24T10:00:00Z",99000,{status:"failed"}),
  fixture("pending","M","premium-monthly-pkr","Ranchers","2026-11-24T10:00:00Z",99000,{status:"pending"}),
  fixture("organic","D","premium-monthly-pkr","Ranchers","2026-11-24T10:00:00Z",99000,{landingPath:"/other"}),
];
const filters={start:"2026-11-24",end:"2026-11-25",product:"jalwa",landing:"/landing1",
  referral:"partner123",campaign:"launch-2026"};
test("Reference A/B exports match filtered verified transactions across 4 platforms and PKT days",()=>{
  const report=buildCampaignReport(rows,filters);
  assert.equal(report.totals.subs,4);
  assert.equal(report.totals.revenueMinor,596900);
  assert.deepEqual(report.dateWise.map(d=>[d.date,d.subs]),[
    ["2026-11-24",3],["2026-11-25",1],
  ]);
  for(const dimension of ["platform","plan","parameter"])
    assert.equal(report.dimensions[dimension].reduce((s,x)=>s+x.subs,0),report.totals.subs);
  const files=unpackStored(generateCampaignXlsx(report));
  assert.equal(files.size,7);
  const a=files.get("xl/worksheets/sheet1.xml"),b=files.get("xl/worksheets/sheet2.xml");
  for(const label of ["Platform","Plan IDs","Parameter / UTM","Ranchers","Bike","KFC",
    "Meta","TikTok","Snapchat","Google","2026-11-24","2026-11-25",
    "Filter: Product","Filter: Platform","Filter: Plan ID","Filter: Parameter / UTM",
    "Filter: Landing Page","Filter: Referral","Filter: Campaign","partner123","launch-2026","596900"])
    assert.ok(a.includes(label)||b.includes(label),"Missing exported evidence "+label);
  for(const label of ["Platform-wise Subs","Plan ID-wise Subs","Parameter/UTM-wise Subs",
    "Verified Gross","596900","Filter: Landing Page"]) assert.ok(b.includes(label),label);
  assert.match(a,/<mergeCell ref="A1:/);
  assert.match(a,/<mergeCell ref="[A-Z]+11:[A-Z]+11"/);
  assert.doesNotMatch(a,/>failed</);
  assert.doesNotMatch(a,/>pending</);
  assert.equal(report.totals.subs,report.dimensions.platform.reduce((s,x)=>s+x.subs,0));
});
test("all report filters propagate into XLSX and date totals do not grow after extra dimensions",()=>{
  const f={...filters,platform:"Meta",plan:"premium-monthly-pkr",parameter:"Ranchers"};
  const report=buildCampaignReport(rows,f);
  assert.equal(report.totals.subs,1);
  const files=unpackStored(generateCampaignXlsx(report));
  for(const page of ["sheet1.xml","sheet2.xml"]) {
    const content=files.get("xl/worksheets/"+page);
    assert.match(content,/Filter: Platform/);
    assert.match(content,/Meta/);
    assert.match(content,/premium-monthly-pkr/);
    assert.match(content,/Ranchers/);
    assert.match(content,/partner123/);
    assert.match(content,/launch-2026/);
  }
});
const daily={
 date:"2026-11-24",timezone:"Asia/Karachi",generatedAt:"2026-11-25T04:10:00Z",
 landingViews:17,uniqueLandingVisitors:13,unknownHeTraffic:17,
 paywallVisits:9,uniquePaywallVisits:8,mpinCount:null,mpinObservable:false,
 successCount:6,failureCount:3,failureReasons:[
  {code:"JC-01",reason:"Payment denied",count:2},
  {code:"Unmapped",reason:"Unknown response",count:1},
 ]};
test("Daily digest reconciles, hides sensitive data, and SMTP mail is actually assembled into a MIME message without external delivery",async()=>{
  const report=buildCampaignReport(rows,{...filters,start:"2026-11-24",end:"2026-11-24"});
  const digest=composeCampaignDailyDigest(daily,report,"2026-11-24");
  assert.equal(digest.subject,"Campaign & JazzCash Daily Logs | 2026-11-24");
  assert.match(digest.text,/Backend verified JazzCash successes \| 6/);
  assert.match(digest.text,/Backend JazzCash failures \| 3/);
  assert.match(digest.text,/Campaign report paid Subs \| 3/);
  assert.match(digest.text,/MPIN stage reached \| Not observable/);
  assert.match(digest.text,/HE \| Unknown/);
  assert.doesNotMatch(digest.text,/Payment denied|Unknown response|030[0-9]{8}/);
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:"unix"});
  const result=await transport.sendMail({
    from:"no-reply@example.invalid",to:"staging-sink@example.invalid",
    subject:digest.subject,text:digest.text,attachments:[
      {filename:digest.filename,content:generateCampaignXlsx(report),
        contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ],
  });
  const mime=result.message.toString("utf8");
  assert.match(mime,/Campaign & JazzCash Daily Logs/);
  assert.match(mime,/Content-Type: application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
  assert.match(mime,/jalwa-campaign-2026-11-24.xlsx/);
  assert.match(mime,/Backend verified JazzCash successes/);
  assert.doesNotMatch(mime,/Payment denied/);
  assert.equal(result.envelope.to[0],"staging-sink@example.invalid");
});
test("Daily digest rejects unmatched totals or invalid timezone before delivery",()=>{
  assert.throws(()=>composeCampaignDailyDigest({...daily,failureCount:4}, {totals:{subs:3,revenueMinor:398900}},"2026-11-24"),/do not reconcile/);
  assert.throws(()=>composeCampaignDailyDigest({...daily,timezone:"UTC"}, {totals:{subs:3,revenueMinor:398900}},"2026-11-24"),/date\/timezone/);
});
