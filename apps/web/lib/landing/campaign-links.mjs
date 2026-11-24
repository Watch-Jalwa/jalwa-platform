const sources={TikTok:"T",Meta:"M",Snapchat:"S",Google:"G",Direct:"D"};
const plans={"premium-monthly-pkr":"1","premium-annual-pkr":"2"};
export function campaignLink(config) {
  const p=String(config.landing_path??"");
  if(!/^\/[a-zA-Z0-9/_-]{1,170}$/.test(p)) throw new Error("Invalid campaign landing path");
  const code=plans[String(config.plan_code??"")];
  if(!code) return null; // do not silently turn unknown price into monthly
  const source=String(config.source??"");
  const params=new URLSearchParams({
    utm:sources[source]??source.slice(0,30),
    utm_source:source.toLowerCase().slice(0,30),
    utm_campaign:String(config.utm_campaign??"").slice(0,120),
    package:code,
    parameter:String(config.parameter??"").slice(0,80),
    ref:String(config.referral??"").slice(0,80),
  });
  return p+"?"+params.toString();
}
