export function campaignConsentGranted():boolean;
export function setCampaignConsent(granted:boolean):void;
export function campaignAnonymousId():string|null;
export function captureCampaignEvent(eventName:string,ctx?:Record<string,unknown>):void;
