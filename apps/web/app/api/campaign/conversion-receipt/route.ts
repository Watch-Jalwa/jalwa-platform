import {NextRequest,NextResponse} from "next/server";
import {RECEIPT_COOKIE,verifyConversionReceipt} from "@/lib/reports/campaign-conversion-receipt.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
  const headers={"cache-control":"no-store"};
  const raw=await request.text().catch(()=>"");
  if(Buffer.byteLength(raw,"utf8")>512)return NextResponse.json({verified:false},{status:413,headers});
  let orderId:unknown;
  try{orderId=JSON.parse(raw)?.orderId;}catch{return NextResponse.json({verified:false},{status:400,headers});}
  const receipt=verifyConversionReceipt(request.cookies.get(RECEIPT_COOKIE)?.value,orderId,process.env.BETTER_AUTH_SECRET);
  if(!receipt)return NextResponse.json({verified:false},{status:403,headers});
  const response=NextResponse.json(receipt,{headers});
  response.cookies.set(RECEIPT_COOKIE,"",{httpOnly:true,sameSite:"lax",path:"/api/campaign/conversion-receipt",maxAge:0});
  return response;
}
