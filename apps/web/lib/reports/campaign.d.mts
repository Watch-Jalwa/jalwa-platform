export const REPORT_TIMEZONE: "Asia/Karachi";
export const UNKNOWN: "Unknown";
export function normalizePlatform(source: unknown): string;
export function karachiDay(instant: string | Date): string;
export function assertDay(day: string): string;
export function karachiBounds(start: string, end: string): {startInclusiveUtc:string; endExclusiveUtc:string};
export type VerifiedCampaignPayment = {
  provider:string; remotePaymentId:string;status:string;verified:boolean;hasSubscription:boolean;
  completedAt:string;amountMinor:number;product:string;source:string;planCode:string;
  parameter:string;landingPath:string;referral:string;campaign:string;
};
export type CampaignFilters = {
  start?:string;end?:string;product?:string;platform?:string;plan?:string;
  parameter?:string;landing?:string;referral?:string;campaign?:string;
};
export type CampaignReport = {
 timezone:string;filters:CampaignFilters;
 totals:{subs:number;revenueMinor:number};
 dimensions:Record<"platform"|"plan"|"parameter",Array<{label:string;subs:number}>>;
 dateWise:Array<{date:string;subs:number;revenueMinor:number;platform:Record<string,number>;plan:Record<string,number>;parameter:Record<string,number>}>;
 definitions:Record<string,string>;
};
export function filterCompletedTransactions(rows:VerifiedCampaignPayment[],filters?:CampaignFilters):VerifiedCampaignPayment[];
export function buildCampaignReport(rows:VerifiedCampaignPayment[],filters?:CampaignFilters):CampaignReport;
export function buildDailyEventCounts(events:Array<{eventName:string;occurredAt:string;anonymousId?:string;sessionId?:string;source?:string}>,day:string):{
 date:string;timezone:string;landingViews:number;uniqueLandingVisitors:number;paywallVisits:number;uniquePaywallVisits:number;
 heTraffic:null;nonHeTraffic:null;unknownHeTraffic:number;mpinCount:number|null;mpinObservable:boolean;note:string;
};
