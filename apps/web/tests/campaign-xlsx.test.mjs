import test from "node:test";
import assert from "node:assert/strict";
import { buildCampaignReport } from "../lib/reports/campaign.mjs";
import { generateCampaignXlsx } from "../lib/reports/campaign-xlsx.mjs";

function storedFiles(buffer) {
  const files=new Map();
  let index=0;
  while(index+30<buffer.length && buffer.readUInt32LE(index)===0x04034b50){
    const compression=buffer.readUInt16LE(index+8);
    assert.equal(compression,0);
    const size=buffer.readUInt32LE(index+18);
    const n=buffer.readUInt16LE(index+26);
    const extra=buffer.readUInt16LE(index+28);
    const filename=buffer.subarray(index+30,index+30+n).toString();
    const body=index+30+n+extra;
    files.set(filename,buffer.subarray(body,body+size).toString());
    index=body+size;
  }
  return files;
}
test("two-sheet Office Open XML file includes matching date wise and detailed totals",()=>{
  const report=buildCampaignReport([
    {provider:"jazzcash",remotePaymentId:"t1",status:"completed",verified:true,hasSubscription:true,
     completedAt:"2026-11-24T10:00:00Z",amountMinor:99000,product:"jalwa",source:"T",planCode:"month",
     parameter:"Ranchers",landingPath:"/mainLanding",referral:"p1",campaign:"launch"},
    {provider:"jazzcash",remotePaymentId:"t2",status:"completed",verified:true,hasSubscription:true,
     completedAt:"2026-11-24T10:00:00Z",amountMinor:299900,product:"jalwa",source:"M",planCode:"annual",
     parameter:"Bike",landingPath:"/landing1",referral:"p2",campaign:"launch"},
  ],{start:"2026-11-24",end:"2026-11-24"});
  const file=generateCampaignXlsx(report);
  assert.equal(file.subarray(0,4).toString("hex"),"504b0304");
  const content=storedFiles(file);
  assert.equal(content.size,7);
  assert.match(content.get("xl/workbook.xml"),/Date-wise Subs/);
  assert.match(content.get("xl/workbook.xml"),/Basic and Detailed/);
  assert.match(content.get("xl/worksheets/sheet1.xml"),/Platform/);
  assert.match(content.get("xl/worksheets/sheet1.xml"),/Ranchers/);
  assert.match(content.get("xl/worksheets/sheet2.xml"),/Basic \/ DETAILED/);
  assert.match(content.get("xl/worksheets/sheet2.xml"),/Total/);
});
test("spreadsheet strings are XML escaped and treated as literal text",()=>{
  const report=buildCampaignReport([{
    provider:"jazzcash",remotePaymentId:"x",status:"completed",verified:true,hasSubscription:true,
    completedAt:"2026-11-24T10:00:00Z",amountMinor:99000,product:"jalwa",source:"M",
    planCode:"=HYPERLINK(1)",parameter:"A&B",landingPath:"/mainLanding",referral:"",
    campaign:"launch",
  }],{start:"2026-11-24",end:"2026-11-24"});
  const file=storedFiles(generateCampaignXlsx(report)).get("xl/worksheets/sheet1.xml");
  assert.match(file,/A&amp;B/);
  assert.match(file,/&apos;=HYPERLINK/);
});
