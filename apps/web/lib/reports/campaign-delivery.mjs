export function dispatchDecision(now, settings, prior) {
  if(!settings?.enabled)return "settings_disabled";
  if(settings.timezone!=="Asia/Karachi" || !Number.isInteger(settings.delivery_hour) || settings.delivery_hour<0 || settings.delivery_hour>23 || !Number.isInteger(settings.delivery_minute) || settings.delivery_minute<0 || settings.delivery_minute>59)throw new Error("Invalid campaign schedule.");
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Karachi",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const part=type=>Number(parts.find(x=>x.type===type)?.value);
  if(part("hour")*60+part("minute")<settings.delivery_hour*60+settings.delivery_minute)return "scheduled_later";
  if(prior?.status==="sent")return "already_sent";
  if(prior?.status==="pending")return "in_progress_or_reconciliation_required";
  if((prior?.attempts??0)>=3)return "retry_limit";
  return "ready";
}

export function allRecipientsAccepted(recipients,accepted,rejected) {
  const normalized=new Set((accepted??[]).map(x=>String(x).trim().toLowerCase()));
  return recipients.length>0 && !(rejected??[]).length && normalized.size===recipients.length && recipients.every(x=>normalized.has(x.trim().toLowerCase()));
}

export function priorKarachiDate(now) {
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  return new Date(Date.parse(day+"T00:00:00Z")-86400000).toISOString().slice(0,10);
}
