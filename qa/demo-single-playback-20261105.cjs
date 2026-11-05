// Actual live guest playback verification of one repaired demo title on both shared demo domains.
// Desktop and mobile Chromium; no tokens, credentials or media URLs are logged.
const fs=require("node:fs/promises");
const path=require("node:path");
const {chromium}=require(process.env.JALWA_PLAYWRIGHT_PATH);
const slug=process.env.DEMO_REPAIR_SLUG||"";
const ALLOWED=[
 "mossy-tree-cc0","ocean-surface-waves-cc0","tiny-waterfall-cc0",
 "tree-trimmer-cc0","counting-chisenbop-cc0","vanellus-vanellus-cc0",
 "how-fossils-form-cc-by","eso-cast-254-light","eso-cast-265-light",
 "proxima-centauri-flythrough-cc-by","invitation-to-pakistan-nara"
];
if(!ALLOWED.includes(slug))throw Error("Invalid demo slug");
const out="demo-single-playback-evidence";
async function testOne(browser,origin,mobile) {
 const view=mobile?"mobile":"desktop";
 const host=new URL(origin).hostname;
 const ctx=await browser.newContext({
   viewport:mobile?{width:390,height:844}:{width:1440,height:900},
   ...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{}),
   reducedMotion:"reduce",locale:"en-PK",timezoneId:"Asia/Karachi"
 });
 const result={slug,domain:host,view};
 try{
   const page=await ctx.newPage();
   const res=await page.goto(origin+"/watch/"+slug,{waitUntil:"domcontentloaded",timeout:25000});
   result.httpStatus=res?.status()||null;
   if(result.httpStatus!==200)throw Error("HTTP "+result.httpStatus);
   const v=page.locator(".self-hosted-media-frame video").first();
   await v.waitFor({state:"attached",timeout:16000});
   await page.waitForFunction(()=>{
     const video=document.querySelector(".self-hosted-media-frame video");
     return Boolean(video&&video.videoWidth&&video.videoHeight);
   },null,{timeout:25000});
   const dims=await page.evaluate(()=>{
     const v=document.querySelector(".self-hosted-media-frame video");
     const f=document.querySelector(".self-hosted-media-frame");
     const b=f.getBoundingClientRect();
     return {width:v.videoWidth,height:v.videoHeight,frameWidth:b.width,
       frameHeight:b.height,controls:v.controls,error:v.error?.code||null,readyState:v.readyState};
   });
   result.video={width:dims.width,height:dims.height};
   result.frameAspect=Math.round(dims.frameWidth/dims.frameHeight*10000)/10000;
   result.videoAspect=Math.round(dims.width/dims.height*10000)/10000;
   if(!(dims.width>dims.height && dims.width<=1280 && dims.height>=200))
     throw Error("Expected native landscape/4:3 re-encode; decoded "+dims.width+"x"+dims.height);
   if(Math.abs(result.videoAspect-result.frameAspect)>0.055)
     throw Error("Video and frame mismatch "+JSON.stringify({frame:result.frameAspect,video:result.videoAspect}));
   if(!dims.controls||dims.error)throw Error("Controls or decode error");
   await v.evaluate(async el=>{el.muted=true;await el.play().catch(()=>{});});
   await page.waitForTimeout(1600);
   let time=await v.evaluate(el=>el.currentTime);
   if(time<0.25){await page.waitForTimeout(2300);time=await v.evaluate(el=>el.currentTime);}
   result.playedSeconds=Math.round(time*100)/100;
   if(time<0.25)throw Error("Playback position did not advance");
   result.passed=true;
   const file=slug+"-"+host+"-"+view+".png";
   await page.screenshot({path:path.join(out,file),animations:"disabled",timeout:12000});
   console.log("ONE_VIDEO_QA_PASS "+JSON.stringify({slug,domain:host,view,video:result.video,aspect:result.videoAspect,playedSeconds:result.playedSeconds}));
 }catch(e){result.passed=false;result.error=String(e?.message||e).split("\n")[0].slice(0,200);
   console.error("ONE_VIDEO_QA_FAIL "+JSON.stringify(result));
 }finally{await ctx.close();}
 return result;
}
async function main(){
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const reports=[];
 try {
   for(const origin of ["https://jalwa-platform.codistan.org","https://watch-jalwa.com"])
     for(const mobile of [false,true])reports.push(await testOne(browser,origin,mobile));
 } finally {await browser.close();}
 const summary={slug,runAt:new Date().toISOString(),count:reports.length,
   passed:reports.filter(x=>x.passed).length,failed:reports.filter(x=>!x.passed).length,
   deviceLimit:"Desktop and mobile Chromium, not real iOS Safari",
   reports};
 await fs.writeFile(path.join(out,"result.json"),JSON.stringify(summary,null,2));
 console.log("ONE_VIDEO_QA_SUMMARY "+JSON.stringify({slug,passed:summary.passed,failed:summary.failed}));
 if(summary.passed!==4)process.exitCode=1;
}
main().catch(e=>{console.error("SINGLE_QA_SETUP_FAIL "+e.message);process.exitCode=1});
