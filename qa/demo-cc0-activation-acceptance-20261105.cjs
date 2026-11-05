// Browser acceptance for an already promoted CC0 demo clip; no credentials/signed URLs logged.
const {chromium}=require(process.env.JALWA_PLAYWRIGHT_PATH);
const fs=require("node:fs/promises");
const path=require("node:path");
const slug="baking-cookies-cc0";
const origins=["https://jalwa-platform.codistan.org","https://watch-jalwa.com"];
const views=[
  {name:"desktop",viewport:{width:1440,height:900},options:{}},
  {name:"mobile",viewport:{width:390,height:844},options:{isMobile:true,hasTouch:true,deviceScaleFactor:2}}
];
const dir="demo-cc0-activation-evidence";
async function main(){
  await fs.mkdir(dir,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const results=[];
  const failures=[];
  try{
    for(const origin of origins){
      for(const view of views){
        const context=await browser.newContext({...view.options,viewport:view.viewport,locale:"en-PK",timezoneId:"Asia/Karachi",reducedMotion:"reduce"});
        const page=await context.newPage();
        const label=new URL(origin).hostname+"-"+view.name;
        try{
          const response=await page.goto(origin+"/watch/"+slug,{waitUntil:"domcontentloaded",timeout:22000});
          if(response?.status()!==200)throw Error("Watch HTTP "+response?.status());
          await page.locator(".self-hosted-media-frame video").waitFor({state:"attached",timeout:12000});
          await page.waitForFunction(()=>{
            const v=document.querySelector(".self-hosted-media-frame video");
            return v && v.videoWidth>0 && v.videoHeight>0;
          },null,{timeout:18000});
          await page.waitForTimeout(200);
          const frame=await page.evaluate(()=>{
            const v=document.querySelector(".self-hosted-media-frame video");
            const outer=document.querySelector(".self-hosted-media-frame");
            const r=outer.getBoundingClientRect();
            return {decodedWidth:v.videoWidth,decodedHeight:v.videoHeight,frameWidth:r.width,frameHeight:r.height,
              videoControls:v.controls,readyState:v.readyState,errorCode:v.error?.code||null};
          });
          if(frame.decodedWidth!==1280||frame.decodedHeight!==720)throw Error("New MP4 not served; decoded "+frame.decodedWidth+"x"+frame.decodedHeight);
          if(Math.abs(frame.frameWidth/frame.frameHeight-(16/9))>0.045)throw Error("Wrong frame aspect on "+label);
          if(!frame.videoControls || frame.errorCode)throw Error("Playback controls/media failure "+label);
          await page.locator(".self-hosted-media-frame video").evaluate(async v=>{
            v.muted=true;
            await v.play().catch(()=>{});
          });
          await page.waitForTimeout(1750);
          const seconds=await page.locator(".self-hosted-media-frame video").evaluate(v=>v.currentTime);
          if(seconds<0.25)throw Error("Actual video time did not advance: "+seconds);
          await page.screenshot({path:path.join(dir,label+".png"),animations:"disabled",timeout:12000});
          results.push({label,httpStatus:200,decodedWidth:1280,decodedHeight:720,frameAspect:Number((frame.frameWidth/frame.frameHeight).toFixed(4)),
            playedSeconds:Number(seconds.toFixed(2)),controls:true});
          console.log("DEMO_BROWSER_PASS "+label+" time="+seconds.toFixed(2));
        }catch(e){failures.push({label,error:String(e?.message||e).split("\n")[0].slice(0,200)});console.error("DEMO_BROWSER_FAIL "+label+" "+String(e?.message||e).split("\n")[0]);}
        finally{await context.close();}
      }
    }
  } finally {await browser.close();}
  await fs.writeFile(path.join(dir,"result.json"),JSON.stringify({createdAt:new Date().toISOString(),slug,results,failures,allPassed:failures.length===0&&results.length===4},null,2));
  if(failures.length||results.length!==4)throw Error("Demo CC0 playback acceptance failed; rollback required");
}
main().catch(e=>{console.error("DEMO_BROWSER_QA_FAIL "+e.message);process.exitCode=1});
