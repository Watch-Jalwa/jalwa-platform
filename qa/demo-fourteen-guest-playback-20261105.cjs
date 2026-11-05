(function fourteenGuestQA(){
const {chromium}=require(process.env.JALWA_PLAYWRIGHT_PATH);
const fs=require("node:fs/promises"),path=require("node:path");
const slug=process.env.DEMO_14_SLUG,sha=process.env.DEMO_14_EXPECTED_SHA;
const accepted=new Set([
"artemis-ii-lunar-flyby-svs","artemis-ii-trajectory-svs","hd-earth-views-svs",
"hst-fly-by-nasa","hst-sm4-rendezvous-nasa","earth-views-from-iss-nasa","apollo-11-eagle-has-landed",
"sprite-fright","spring-blender","cosmos-laundromat","caminandes-llamigos",
"grca-south-rim-summer-timelapse","grca-animals-broll","grca-south-rim-winter-scenic"
]);
if(!accepted.has(slug)||!/^[a-f0-9]{40}$/.test(sha))throw Error("Invalid QA target");
const out="jalwa-14-guest-media-evidence";
async function check(browser,host,mobile){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},
   ...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{}),
   locale:"en-PK",timezoneId:"Asia/Karachi",reducedMotion:"reduce"});
 const result={slug,host,device:mobile?"mobile-emulated":"desktop",passed:false};
 try {
  const page=await ctx.newPage();
  const hp=await page.request.get("https://"+host+"/api/health",{timeout:12000});
  if(hp.status()!==200)throw Error("Health HTTP "+hp.status());
  const h=await hp.json();
  if(h.status!=="ready"||h.version!==sha)throw Error("Demo release changed");
  const res=await page.goto("https://"+host+"/watch/"+slug,{waitUntil:"domcontentloaded",timeout:30000});
  if(res?.status()!==200)throw Error("Watch page "+res?.status());
  await page.locator("h1").waitFor({state:"visible",timeout:10000});
  const video=page.locator(".self-hosted-media-frame video").first();
  await video.waitFor({state:"attached",timeout:15000});
  await page.waitForFunction(()=>{
    const el=document.querySelector(".self-hosted-media-frame video");
    return Boolean(el&&el.videoWidth>100&&el.videoHeight>100&&el.readyState>=1);
  },null,{timeout:35000});
  const dims=await page.evaluate(()=>{
    const el=document.querySelector(".self-hosted-media-frame video");
    const frame=document.querySelector(".self-hosted-media-frame");
    const f=frame.getBoundingClientRect();
    return {width:el.videoWidth,height:el.videoHeight,frameWidth:f.width,frameHeight:f.height,
      controls:el.controls,error:el.error?.code||null,readyState:el.readyState,duration:el.duration};
  });
  if(!dims.controls||dims.error)throw Error("Controls/decode failed");
  if(!(dims.frameWidth>=120&&dims.frameHeight>=80))throw Error("Tiny media container");
  const sourceAspect=dims.width/dims.height,displayAspect=dims.frameWidth/dims.frameHeight;
  if(Math.abs(sourceAspect-displayAspect)>0.06)throw Error("Video/frame aspect mismatch "+JSON.stringify(dims));
  await video.evaluate(async el=>{el.muted=true;await el.play().catch(()=>{});});
  await page.waitForTimeout(1800);
  let seconds=await video.evaluate(el=>el.currentTime);
  if(seconds<0.25){await page.waitForTimeout(3000);seconds=await video.evaluate(el=>el.currentTime);}
  if(!(seconds>=0.25))throw Error("Video playback not advancing");
  result.passed=true;
  result.decoder=[dims.width,dims.height];
  result.aspect=Number(sourceAspect.toFixed(4));
  result.playedSeconds=Number(seconds.toFixed(2));
  await page.screenshot({path:path.join(out,slug+"-"+host+"-"+result.device+".png"),animations:"disabled",timeout:14000});
  console.log("FOURTEEN_GUEST_PASS "+JSON.stringify(result));
 } catch(e){
  result.error=String(e?.message||e).split("\n")[0].slice(0,240);
  console.error("FOURTEEN_GUEST_FAIL "+JSON.stringify(result));
 }finally{await ctx.close();}
 return result;
}
async function main(){
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{for(const host of ["jalwa-platform.codistan.org","watch-jalwa.com"])
   for(const mobile of [false,true])results.push(await check(browser,host,mobile));
 }finally{await browser.close();}
 const p=results.filter(r=>r.passed).length;
 await fs.writeFile(path.join(out,"results.json"),JSON.stringify({slug,version:sha,passes:p,failures:4-p,results,realDeviceQA:false},null,2));
 console.log("FOURTEEN_GUEST_SUMMARY "+JSON.stringify({slug,passes:p,failures:4-p}));
 if(p!==4)process.exitCode=1;
}
main().catch(e=>{console.error("FOURTEEN_GUEST_FATAL "+String(e));process.exitCode=1});
})();
