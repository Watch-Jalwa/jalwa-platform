// Strict guest playback acceptance for all 16 previously reported Jalwa demo videos.
// Desktop and emulated mobile Chromium, plus seven public-domain comparison URLs.
// No signed media URLs/cookies/tokens are saved or printed. Any failure must roll back
// the 11-video demo batch while preserving each original processed R2 object.
const fs=require("node:fs/promises");
const path=require("node:path");
const {chromium}=require(process.env.JALWA_PLAYWRIGHT_PATH);
const slugs=[
 "mossy-tree-cc0","baking-cookies-cc0","ocean-surface-waves-cc0",
 "tiny-waterfall-cc0","tree-trimmer-cc0","counting-chisenbop-cc0",
 "vanellus-vanellus-cc0","how-fossils-form-cc-by","eso-cast-254-light",
 "eso-cast-265-light","proxima-centauri-flythrough-cc-by",
 "invitation-to-pakistan-nara","promise-of-pakistan-geography",
 "wikipedia-science-comms-cc-by","big-buck-bunny","elephants-dream"
];
const padded=new Set(slugs.slice(0,12));
const reports=[];
const originStaging="https://jalwa-platform.codistan.org";
const originPublic="https://watch-jalwa.com";
const jobs=[
 ...slugs.flatMap(slug=>[
   {origin:originStaging,slug,device:"desktop"},
   {origin:originStaging,slug,device:"mobile"},
 ]),
 ...slugs.slice(0,7).map(slug=>({origin:originPublic,slug,device:"desktop"}))
];
const evidence="demo-16-playback-acceptance";
async function check(browser,item){
 const label=(item.origin===originPublic?"live":"staging")+"-"+item.slug+"-"+item.device;
 const mobile=item.device==="mobile";
 const context=await browser.newContext({
   viewport:mobile?{width:390,height:844}:{width:1440,height:900},
   ...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{}),
   locale:"en-PK",timezoneId:"Asia/Karachi",reducedMotion:"reduce"
 });
 const page=await context.newPage();
 const result={label,slug:item.slug,device:item.device,domain:new URL(item.origin).hostname};
 try{
   const response=await page.goto(item.origin+"/watch/"+item.slug,{waitUntil:"domcontentloaded",timeout:20000});
   result.httpStatus=response?.status()||null;
   if(result.httpStatus!==200)throw Error("Watch route status "+result.httpStatus);
   await page.locator(".self-hosted-media-frame video").first().waitFor({state:"attached",timeout:20000});
   await page.waitForFunction(()=>{
     const v=document.querySelector(".self-hosted-media-frame video");
     return Boolean(v&&v.videoWidth&&v.videoHeight);
   },null,{timeout:28000});
   await page.waitForTimeout(150);
   const value=await page.evaluate(()=>{
     const v=document.querySelector(".self-hosted-media-frame video");
     const frame=document.querySelector(".self-hosted-media-frame");
     const shell=document.querySelector(".player-shell");
     const f=frame.getBoundingClientRect(),vRect=v.getBoundingClientRect(),s=shell?.getBoundingClientRect();
     return {width:v.videoWidth,height:v.videoHeight,
       frameWidth:f.width,frameHeight:f.height,
       playerWidth:s?.width||0,playerHeight:s?.height||0,
       displayedWidth:vRect.width,displayedHeight:vRect.height,
       controls:v.controls,videoError:v.error?.code||null,readyState:v.readyState};
   });
   result.decode={width:value.width,height:value.height};
   result.frameAspect=Number((value.frameWidth/value.frameHeight).toFixed(4));
   result.videoAspect=Number((value.width/value.height).toFixed(4));
   result.aspectDelta=Number(Math.abs(result.frameAspect-result.videoAspect).toFixed(4));
   if(padded.has(item.slug) && value.width===720 && value.height===1280){
     throw Error("Artificially padded 720x1280 legacy encode still in use for "+item.slug);
   }
   if(result.aspectDelta>0.055)throw Error("Aspect mismatch "+result.aspectDelta);
   if(value.frameWidth<120||value.frameHeight<80)throw Error("Tiny rendered media frame");
   if(!value.controls||value.videoError)throw Error("Missing native controls or decode error");
   await page.locator(".self-hosted-media-frame video").first().evaluate(async v=>{
     v.muted=true;await v.play().catch(()=>{});
   });
   await page.waitForTimeout(2200);
   let seconds=await page.locator(".self-hosted-media-frame video").first().evaluate(v=>v.currentTime);
   if(seconds<0.30){
     await page.waitForTimeout(2400);
     seconds=await page.locator(".self-hosted-media-frame video").first().evaluate(v=>v.currentTime);
   }
   result.playedSeconds=Number(seconds.toFixed(2));
   if(seconds<0.30)throw Error("Video playback did not advance");
   await page.screenshot({path:path.join(evidence,label+".png"),animations:"disabled",timeout:12000});
   result.passed=true;
   console.log("DEMO_16_PASS "+label+" decoded="+value.width+"x"+value.height+" t="+result.playedSeconds);
 }catch(e){
   result.passed=false;
   result.error=String(e?.message||e).split("\n")[0].slice(0,210);
   console.error("DEMO_16_FAIL "+label+" "+result.error);
   await page.screenshot({path:path.join(evidence,label+"-failure.png"),animations:"disabled",timeout:9000}).catch(()=>{});
 }finally {await context.close();}
 return result;
}
async function main(){
 await fs.mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true});
 let idx=0;
 try{
   await Promise.all(Array.from({length:3},async ()=>{
     while(idx<jobs.length){
       const item=jobs[idx++];
       reports.push(await check(browser,item));
     }
   }));
 }finally{await browser.close();}
 reports.sort((a,b)=>a.label.localeCompare(b.label));
 const passed=reports.filter(r=>r.passed).length;
 const summary={generatedAt:new Date().toISOString(),demoOnly:true,checks:jobs.length,passed,
   failed:reports.length-passed,realDeviceTest:false,
   browser:"Chromium desktop + emulated mobile",reports};
 await fs.writeFile(path.join(evidence,"results.json"),JSON.stringify(summary,null,2));
 console.log("DEMO_16_QA_SUMMARY "+JSON.stringify({checks:summary.checks,passed:summary.passed,failed:summary.failed}));
 if(summary.failed>0 || summary.passed!==39)throw Error("Strict demo video QA failed; restore batch 11 media pointers");
}
main().catch(e=>{console.error("DEMO_16_QA_ERROR "+String(e?.message||e));process.exitCode=1});
