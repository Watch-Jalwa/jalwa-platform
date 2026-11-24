import {NextRequest,NextResponse} from "next/server";
import {RECEIPT_COOKIE,verifyConversionReceipt} from "@/lib/reports/campaign-conversion-receipt.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
  const headers={"cache-control":"no-store"};
  const raw=await request.text().catch(()=>"");
  // Body may include the signed receipt from ?cv= after JazzCash return (~200-400B).
  if(Buffer.byteLength(raw,"utf8")>2048)return NextResponse.json({verified:false},{status:413,headers});
  let orderId:unknown;
  let bodyReceipt:unknown;
  try{
    const body=JSON.parse(raw) as {orderId?:unknown;receipt?:unknown};
    orderId=body?.orderId;
    bodyReceipt=body?.receipt;
  }catch{return NextResponse.json({verified:false},{status:400,headers});}
  const secret=process.env.BETTER_AUTH_SECRET;
  const fromBody=typeof bodyReceipt==="string"?bodyReceipt:"";
  const fromCookie=request.cookies.get(RECEIPT_COOKIE)?.value ?? "";
  // Prefer URL-carried receipt (survives cross-site cookie drops), then cookie.
  const receipt=
    verifyConversionReceipt(fromBody,orderId,secret) ??
    verifyConversionReceipt(fromCookie,orderId,secret);
  if(!receipt)return NextResponse.json({verified:false},{status:403,headers});
  const response=NextResponse.json(receipt,{headers});
  response.cookies.set(RECEIPT_COOKIE,"",{httpOnly:true,sameSite:"lax",path:"/api/campaign/conversion-receipt",maxAge:0});
  return response;
}
