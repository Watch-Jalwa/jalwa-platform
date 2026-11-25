export function composeCampaignDailyDigest(
  daily:{date:string;timezone:string;generatedAt:string;landingViews:number;uniqueLandingVisitors:number;
    unknownHeTraffic:number;paywallVisits:number;uniquePaywallVisits:number;
    mpinCount:number|null;mpinObservable:boolean;successCount:number;failureCount:number;
    failureReasons:Array<{code:string;reason:string;count:number}>},
  paid:{totals:{subs:number;revenueMinor:number}},
  day:string
):{subject:string;text:string;filename:string;reconciled:true};
