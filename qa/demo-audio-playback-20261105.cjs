// Read-only guest playback acceptance for one already-published Jalwa audio title.
// Real Chromium playback, two internal demo domains, desktop and mobile emulation.
const fs=require("node:fs/promises");
const { chromium }=require(process.env.JALWA_PLAYWRIGHT_PATH);
const path=require("node:path");
const slug=process.env.AUDIO_REPAIR_SLUG;
const allowed=new Set(["huamei-bird-calling-cc0","house-sparrow-tschilp-cc0","abrasive-bird-debate-cc0"]);
if(!allowed.has(slug))throw Error("Unsafe test title");
const expected=process.env.AUDIO_EXPECTED_SHA;
const dir="demo-audio-browser-evidence";
async function test(browser,host,mobile){
 const profile=mobile?"mobile":"desktop";
 const ctx=await browser.newContext({
   viewport:mobile?{width:390,height:844}:{width:1440,height:900},
   ...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{}),
   locale:"en-PK",timezoneId:"Asia/Karachi",reducedMotion:"reduce"
 });
 const result={host,slug,profile,passed:false};
 try{
  const page=await ctx.newPage();
  const h=await page.request.get("https://"+host+"/api/health");
  if(h.status()!==200)throw Error("Demo health "+h.status());
  const health=await h.json();
  if(health.status!=="ready"||health.version!==expected)throw Error("Demo release mismatch");
  const response=await page.goto("https://"+host+"/watch/"+slug,{waitUntil:"domcontentloaded",timeout:25000});
  if(response?.status()!==200)throw Error("Watch page returned "+response?.status());
  const audio=page.locator('[data-testid="self-hosted-audio"] audio').first();
  await audio.waitFor({state:"visible",timeout:20000});
  await page.waitForFunction(()=>{
   const a=document.querySelector('[data-testid="self-hosted-audio"] audio');
   return a && a.readyState>=1 && a.duration>0;
  },null,{timeout:25000});
  const src=await audio.evaluate(el=>el.currentSrc||el.src);
  if(!src.startsWith("https://"+host+"/api/media/")&&!src.includes("/api/media/"))throw Error("Expected signed first-party media URL");
  const u=new URL(src);
  if(!u.searchParams.has("token"))throw Error("Unsigned audio playback");
  const partial=await page.request.get(src,{headers:{Range:"bytes=0-4095"},timeout:20000});
  if(partial.status()!==206)throw Error("Byte range denied "+partial.status());
  const type=partial.headers()["content-type"]||"";
  if(!type.includes("audio/mp4"))throw Error("Wrong audio MIME "+type);
  const unsigned=await page.request.get(u.origin+u.pathname,{timeout:15000});
  if(unsigned.status()!==403)throw Error("Unsigned direct media fetch not blocked: "+unsigned.status());
  await audio.evaluate(async el=>{el.muted=true;await el.play();});
  await page.waitForTimeout(1500);
  let played=await audio.evaluate(el=>el.currentTime);
  if(played<0.25){await page.waitForTimeout(1200);played=await audio.evaluate(el=>el.currentTime);}
  if(played<0.25)throw Error("Audio did not play");
  const time=await audio.evaluate(el=>({duration:el.duration,currentTime:el.currentTime,paused:el.paused,hasControls:el.controls,error:el.error?.code||null}));
  if(!time.hasControls||time.error)throw Error("Native audio player controls/decode failed");
  if(await page.locator('[data-testid="self-hosted-media-frame"] video').count())throw Error("Unexpected synthetic video in audio player");
  result.passed=true;result.time=Math.round(played*100)/100;result.mime=type;
  await page.screenshot({path:path.join(dir,slug+"-"+host+"-"+profile+".png"),animations:"disabled",timeout:14000});
  console.log("DEMO_AUDIO_QA_PASS "+JSON.stringify(result));
 }catch(e){result.error=String(e?.message||e).split("\n")[0].slice(0,260);console.error("DEMO_AUDIO_QA_FAIL "+JSON.stringify(result));}
 finally{await ctx.close();}
 return result;
}
async function main(){
 await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
   for(const host of ["jalwa-platform.codistan.org","watch-jalwa.com"])
    for(const mobile of [false,true])results.push(await test(browser,host,mobile));
 }finally{await browser.close();}
 const summary={slug,results,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,
   realPhysicalDevice:false,checkedAt:new Date().toISOString()};
 await fs.writeFile(path.join(dir,"results.json"),JSON.stringify(summary,null,2));
 console.log("DEMO_AUDIO_QA_SUMMARY "+JSON.stringify({slug,passed:summary.passed,failed:summary.failed}));
 if(summary.passed!==4)process.exitCode=1;
}
main().catch(e=>{console.error("DEMO_AUDIO_QA_FATAL "+String(e));process.exitCode=1});
