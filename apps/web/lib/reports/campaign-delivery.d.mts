export function dispatchDecision(now:Date, settings:{enabled:boolean;timezone:string;delivery_hour:number;delivery_minute:number}|null|undefined, prior:{status:string;attempts:number}|null|undefined):string;
export function allRecipientsAccepted(recipients:string[], accepted:unknown[]|undefined, rejected:unknown[]|undefined):boolean;
export function priorKarachiDate(now:Date):string;
