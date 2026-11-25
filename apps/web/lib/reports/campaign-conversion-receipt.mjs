import {createHmac,timingSafeEqual} from "node:crypto";
export const RECEIPT_COOKIE="jalwa_verified_conversion";
const validOrder=/^[a-zA-Z0-9_-]{8,100}$/;
const validPlan=/^[a-zA-Z0-9_-]{1,80}$/;
function signature(payload,secret){return createHmac("sha256",secret).update("jalwa-conversion-v1:"+payload).digest("base64url");}
export function createConversionReceipt(orderId,planCode,secret,now=Date.now()){
  if(!validOrder.test(orderId)||!validPlan.test(planCode)||typeof secret!=="string"||secret.length<24)return null;
  const payload=Buffer.from(JSON.stringify({orderId,planCode,exp:now+600000})).toString("base64url");
  return payload+"."+signature(payload,secret);
}
export function verifyConversionReceipt(token,orderId,secret,now=Date.now()){
  if(typeof token!=="string"||token.length>1024||typeof secret!=="string"||secret.length<24)return null;
  const [payload,mac,...extra]=token.split(".");
  if(!payload||!mac||extra.length)return null;
  const expected=Buffer.from(signature(payload,secret)),provided=Buffer.from(mac);
  if(expected.length!==provided.length||!timingSafeEqual(expected,provided))return null;
  try{const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if(data.orderId!==orderId||!validOrder.test(data.orderId)||!validPlan.test(data.planCode)||
      !Number.isSafeInteger(data.exp)||data.exp<=now)return null;
    return {verified:true,orderId:data.orderId,planCode:data.planCode};
  }catch{return null;}
}
