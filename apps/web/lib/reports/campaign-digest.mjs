// Pure daily reporting format, shared by SMTP sender and isolated acceptance tests.
// Only aggregate data is permitted; provider messages/codes must be normalized upstream.
function finiteInt(value,label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid "+label);
  return value;
}
function safeCode(value) {
  const code=String(value??"Unmapped").trim().slice(0,60);
  return /^[a-zA-Z0-9._ -]+$/.test(code) ? code : "Unmapped";
}
export function composeCampaignDailyDigest(daily,paid,day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)|| daily.date!==day || daily.timezone!=="Asia/Karachi")
    throw new Error("Daily report date/timezone mismatch.");
  const success=finiteInt(daily.successCount,"payment success");
  const fail=finiteInt(daily.failureCount,"payment failure");
  const subs=finiteInt(paid.totals?.subs,"campaign subscription total");
  const amount=finiteInt(paid.totals?.revenueMinor,"campaign revenue");
  const reasons=(daily.failureReasons??[]).map(x=>({
    code:safeCode(x.code), reason:"Provider code mapping: "+safeCode(x.code),
    count:finiteInt(x.count,"failure reason count"),
  }));
  const groupedReasonTotal=reasons.reduce((s,x)=>s+x.count,0);
  if(groupedReasonTotal!==fail) throw new Error("Payment failure reasons do not reconcile.");
  const subject="Campaign & JazzCash Daily Logs | "+day;
  const lines=[
    "Jalwa — Campaign & JazzCash Daily Logs",
    "Reporting day: "+day+" (Asia/Karachi)",
    "Generated: "+String(daily.generatedAt),
    "",
    "Metric | Count",
    "Landing views | "+finiteInt(daily.landingViews,"landing views"),
    "Unique attributable visitors | "+finiteInt(daily.uniqueLandingVisitors,"unique visitors"),
    "HE | Unknown (provider classification not available)",
    "NON HE | Unknown (provider classification not available)",
    "Unknown HE traffic | "+finiteInt(daily.unknownHeTraffic,"unknown HE traffic"),
    "JazzCash paywall visits | "+finiteInt(daily.paywallVisits,"paywall visits"),
    "Unique JazzCash paywall visits | "+finiteInt(daily.uniquePaywallVisits,"unique checkout visitors"),
    "MPIN stage reached | "+(daily.mpinObservable===true && Number.isSafeInteger(daily.mpinCount)
       ? daily.mpinCount : "Not observable"),
    "Backend verified JazzCash successes | "+success,
    "Backend JazzCash failures | "+fail,
    "Campaign report paid Subs | "+subs,
    "Campaign report gross (minor units) | "+amount,
    "",
    "Failure code | Normalized reason | Attempts",
    ...reasons.map(x=>[x.code,x.reason,x.count].join(" | ")),
    "",
    "Note: Campaign-attributed subscriptions are a reporting slice; success totals count all JazzCash payment records.",
    "No MPIN, OTP, full phone number or wallet credentials are included.",
  ];
  return {subject,text:lines.join("\n"),filename:"jalwa-campaign-"+day+".xlsx",reconciled:true};
}
