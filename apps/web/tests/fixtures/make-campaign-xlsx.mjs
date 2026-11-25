import { writeFileSync } from "node:fs";
import {buildCampaignReport} from "../../lib/reports/campaign.mjs";
import {generateCampaignXlsx} from "../../lib/reports/campaign-xlsx.mjs";
const file=process.argv[2];
if(!file) throw Error("Usage: node make-campaign-xlsx.mjs <file>");
const rows=[
  {remotePaymentId:"paid-1",source:"M",planCode:"premium-monthly-pkr",parameter:"Ranchers",amountMinor:99000},
  {remotePaymentId:"paid-2",source:"T",planCode:"premium-annual-pkr",parameter:"Bike",amountMinor:299900},
].map(x=>({provider:"jazzcash",status:"completed",verified:true,hasSubscription:true,
  completedAt:"2026-11-24T12:00:00.000Z",product:"jalwa",landingPath:"/landing1",
  referral:"partner",campaign:"launch",...x}));
writeFileSync(file,generateCampaignXlsx(buildCampaignReport(rows,{start:"2026-11-24",end:"2026-11-24"})));
