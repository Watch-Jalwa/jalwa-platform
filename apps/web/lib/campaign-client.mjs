const KEY="jalwa_campaign_analytics_consent";
const ANON="jalwa_campaign_anonymous_id";
const TTL=30*24*60*60*1000;
export function campaignConsentGranted() {
  if(typeof window==="undefined") return false;
  try {return window.localStorage.getItem(KEY)==="granted";}catch{return false;}
}
export function setCampaignConsent(granted){
  if(typeof window==="undefined") return;
  try{
    window.localStorage.setItem(KEY,granted?"granted":"denied");
    if(!granted) window.localStorage.removeItem(ANON);
    window.dispatchEvent(new Event("jalwa-campaign-consent"));
  }catch{/* private mode; no tracking identity */}
}
export function campaignAnonymousId() {
  if(typeof window==="undefined" || !campaignConsentGranted()) return null;
  try{
    const current=JSON.parse(window.localStorage.getItem(ANON)||"null");
    if(current?.id && current.expiresAt>Date.now() && /^[0-9a-f-]{36}$/i.test(current.id)) return current.id;
    const id=crypto.randomUUID();
    window.localStorage.setItem(ANON,JSON.stringify({id,expiresAt:Date.now()+TTL}));
    return id;
  }catch{return null;}
}
export function captureCampaignEvent(eventName,ctx={}){
  if(typeof window==="undefined") return Promise.resolve();
  const consent=campaignConsentGranted();
  const anonymousId=consent?campaignAnonymousId():null;
  const eventKey=crypto.randomUUID();
  const googleCookie=consent?document.cookie.match(/(?:^|;\\s*)_ga=GA\\d\\.\\d\\.([0-9]+\\.[0-9]+)/):null;
  const gaClientId=googleCookie?.[1]??null;
  const body={eventName,eventKey,consent,anonymousId,gaClientId,
    landingPath:ctx.landingPath||window.location.pathname,
    utm:ctx.utm,utmSource:ctx.utm_source,utmMedium:ctx.utm_medium,
    utmCampaign:ctx.utm_campaign,utmContent:ctx.utm_content,
    package:ctx.package,planCode:ctx.planCode,parameter:ctx.parameter,ref:ctx.ref};
  return fetch("/api/campaign/event",{
    method:"POST",headers:{"content-type":"application/json"},
    credentials:"same-origin",keepalive:true,body:JSON.stringify(body),
  }).catch(()=>{ /* analytics must not interrupt checkout */ });
}
