/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_SCHEMA_VERSION, REPORT_TIMEZONE, METRIC_DEFINITIONS, buildCsv } from "@/lib/reports/premium.mjs";
import { getPaymentLedger, getPremiumSummary, getSubscriptionLedger, reportContext, type ReportInput } from "@/lib/studio/premium-report-data";
import { getBenefitCostReport, getReconciliationReport, getRecurringCustomers } from "@/lib/studio/premium-report-special";
export { getPaymentLedger, getPremiumSummary, getSubscriptionLedger, reportContext, getBenefitCostReport, getReconciliationReport, getRecurringCustomers };
export type { ReportInput };

const columns:Record<string,{label:string,value:string}[]> = {
  payments:[{label:"Payment ID",value:"id"},{label:"User",value:"user"},{label:"Plan",value:"plan"},{label:"Price code",value:"priceCode"},{label:"Purpose",value:"purpose"},{label:"Amount minor",value:"amountMinor"},{label:"Currency",value:"currency"},{label:"Provider",value:"provider"},{label:"Internal status",value:"internalStatus"},{label:"Provider status",value:"providerStatus"},{label:"Provider order reference",value:"providerOrderReference"},{label:"Created at UTC",value:"createdAt"},{label:"Completed at UTC",value:"completedAt"},{label:"Failed at UTC",value:"failedAt"},{label:"Reconciliation state",value:"reconciliationState"},{label:"Attention reason",value:"attentionReason"}],
  subscriptions:[{label:"Subscription ID",value:"id"},{label:"User",value:"user"},{label:"Plan",value:"plan"},{label:"Price code",value:"priceCode"},{label:"Status",value:"status"},{label:"Activation source",value:"activationSource"},{label:"Activated at UTC",value:"activatedAt"},{label:"Period start UTC",value:"currentPeriodStart"},{label:"Period end UTC",value:"currentPeriodEnd"},{label:"Renewal due UTC",value:"renewalDueAt"},{label:"Cancel at period end",value:"cancelAtPeriodEnd"},{label:"Grace ends UTC",value:"graceEndsAt"},{label:"Successful renewals",value:"successfulRenewalCount"},{label:"Failed renewals",value:"failedRenewalCount"},{label:"Lifetime collected minor",value:"lifetimeCollectedRevenueMinor"},{label:"Currency",value:"currency"}],
  recurring:[{label:"User",value:"user"},{label:"Completed renewal",value:"completedRenewal"},{label:"Failed renewal",value:"failedRenewal"}],
  reconciliation:[{label:"Case ID",value:"id"},{label:"Kind",value:"kind"},{label:"Status",value:"status"},{label:"Order ID",value:"orderId"},{label:"Amount minor",value:"amountMinor"},{label:"Currency",value:"currency"},{label:"Provider",value:"provider"},{label:"Reason",value:"reason"},{label:"Created at UTC",value:"createdAt"}],
};

export async function generatePremiumCsv(type:string,input:ReportInput) {
  let payload:any;
  if (type==="payments") payload=await getPaymentLedger(input,true);
  else if (type==="subscriptions") payload=await getSubscriptionLedger(input,true);
  else if (type==="recurring") payload=await getRecurringCustomers(input,true);
  else if (type==="reconciliation") payload=await getReconciliationReport(input,true);
  else if (type==="summary") payload=await getPremiumSummary(input);
  else if (type==="benefits") { payload=await getBenefitCostReport(input); throw new Error(payload.reason); }
  else throw new Error("Unsupported Premium report export type.");
  const rows = type==="summary" ? [payload.kpis] : payload.rows;
  const selectedColumns = type==="summary" ? Object.keys(payload.kpis).map((key)=>({label:key,value:key})) : columns[type];
  const csv=buildCsv(rows,selectedColumns);
  const hash=createHash("sha256").update(csv).digest("hex");
  return { csv,hash,rowCount:rows.length,payload,filename:`jalwa-premium-${type}-${payload.effectiveRange.startDate}-to-${payload.effectiveRange.endDate}.csv` };
}

export async function auditPremiumExport(actorId:string,type:string,result:{hash:string;rowCount:number;payload:any}) {
  const { error }=await createAdminClient().from("audit_logs").insert({actor_id:actorId,action:"premium_report_exported",entity_type:"premium_report",entity_id:type,metadata:{report_type:type,schema_version:REPORT_SCHEMA_VERSION,timezone:REPORT_TIMEZONE,filters:result.payload.filters,effective_range:result.payload.effectiveRange,row_count:result.rowCount,content_sha256:result.hash}});
  if (error) throw error;
}

export function reportDefinitions(){return {schemaVersion:REPORT_SCHEMA_VERSION,timezone:REPORT_TIMEZONE,metricDefinitions:METRIC_DEFINITIONS};}
