export const RECEIPT_COOKIE:string;
export function createConversionReceipt(orderId:string,planCode:string,secret:string,now?:number):string|null;
export function verifyConversionReceipt(token:unknown,orderId:unknown,secret:string|undefined,now?:number):{verified:true;orderId:string;planCode:string}|null;
