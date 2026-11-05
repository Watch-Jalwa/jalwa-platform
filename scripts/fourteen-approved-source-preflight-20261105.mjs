(function officialPreflight(){
const entries=[
 {slug:"artemis-ii-lunar-flyby-svs",type:"svs",page:"https://svs.gsfc.nasa.gov/5536",wanted:"a2_flyby_1min_720p30.mp4"},
 {slug:"artemis-ii-trajectory-svs",type:"svs",page:"https://svs.gsfc.nasa.gov/5610/",wanted:"artemis2_full_1080p60.mp4"},
 {slug:"hd-earth-views-svs",type:"svs",page:"https://svs.gsfc.nasa.gov/10766/",wanted:"Earth_View_shuttle_over_clouds.webmhd.webm"},
 {slug:"hst-fly-by-nasa",type:"nasa",nasaId:"GSFC_20080520_HST_m10216_Whip_Pan"},
 {slug:"hst-sm4-rendezvous-nasa",type:"nasa",nasaId:"GSFC_20080822_HST_m10329_Capture_005"},
 {slug:"earth-views-from-iss-nasa",type:"nasa",nasaId:"NHQ_2019_0626_Earth Views from the ISS"},
 {slug:"apollo-11-eagle-has-landed",type:"nasa",nasaId:"KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928"},
 {slug:"sprite-fright",type:"blender",uuid:"a69d68a5-a0e0-4a80-9d66-49f093c97aaf",title:"Sprite Fright - Open Movie by Blender Studio"},
 {slug:"spring-blender",type:"blender",uuid:"3d95fb3d-c866-42c8-9db1-fe82f48ccb95",title:"Spring - Blender Open Movie"},
 {slug:"cosmos-laundromat",type:"blender",uuid:"f507dfdc-e73e-45a4-9778-d758cbe1ce96",title:"Cosmos Laundromat - First Cycle"},
 {slug:"caminandes-llamigos",type:"blender",uuid:"23f3ef79-15dc-44c5-aa45-cf92e78a4509",title:"Caminandes 3: Llamigos"},
 {slug:"grca-south-rim-summer-timelapse",type:"nps",uuid:"86B0B928-155D-451F-6702D6AE1A150C99"},
 {slug:"grca-animals-broll",type:"nps",uuid:"FB01726E-5E99-40D9-B93E-D98088B24AE9"},
 {slug:"grca-south-rim-winter-scenic",type:"nps",uuid:"2420D96E-155D-451F-67F5DF1C124619EA"}
];
async function fetchPage(url){const c=new AbortController();const t=setTimeout(()=>c.abort(),18000);try{
 const r=await fetch(url,{headers:{"user-agent":"Jalwa/1.0 (internal-demo approved-source-preflight)"},signal:c.signal});
 if(!r.ok)throw Error("HTTP "+r.status+" "+new URL(r.url).hostname);
 return {body:await r.text(),finalUrl:r.url};
}finally{clearTimeout(t)}}
function official(u,type){try{
 const h=new URL(u).hostname.toLowerCase();
 return type==="nps"? h==="www.nps.gov"||h==="npgallery.nps.gov"||h==="nps.gov"||h.endsWith(".nps.gov") :
 type==="blender"?h==="video.blender.org"||h==="download.blender.org" :
 type==="svs"?h==="svs.gsfc.nasa.gov" :
 type==="nasa"?h==="images-assets.nasa.gov" :false;
}catch{return false}}
async function scan(item){
 try{
  if(item.type==="blender"){
    const {body}=await fetchPage("https://video.blender.org/api/v1/videos/"+item.uuid);
    const d=JSON.parse(body);
    const files=(d.files||[]).map(f=>({fileDownloadUrl:f.fileDownloadUrl,fileUrl:f.fileUrl,size:f.size,resolution:f.resolution?.label,mime:f.mimeType}))
      .filter(f=>official(f.fileDownloadUrl||f.fileUrl,"blender"));
    const other=(d.streamingPlaylists||[]).flatMap(p=>p.files||[]).slice(0,5).map(f=>({url:f.fileDownloadUrl||f.fileUrl,size:f.size,resolution:f.resolution?.label}));
    console.log("OFFICIAL_SOURCE "+JSON.stringify({slug:item.slug,type:item.type,name:d.name,account:d.account?.name,uuid:d.uuid,duration:d.duration,files,other}));
    return;
  }
  if(item.type==="nasa"){
    const {body}=await fetchPage("https://images-api.nasa.gov/asset/"+encodeURIComponent(item.nasaId));
    const d=JSON.parse(body);
    const files=(d.collection?.items||[]).map(i=>i.href).filter(u=>/\.mp4(?:\?|$)/i.test(u)).map(u=>u.replace(/^http:/,"https:")).filter(u=>official(u,"nasa"));
    console.log("OFFICIAL_SOURCE "+JSON.stringify({slug:item.slug,type:item.type,id:item.nasaId,mp4:files.slice(0,12)}));
    return;
  }
  if(item.type==="svs"){
    const {body}=await fetchPage(item.page);
    const urls=[...new Set((body.match(/https?:\/\/[^\s"'<>]+\.mp4|https?:\/\/[^\s"'<>]+\.webm/ig)||[]).map(v=>v.replaceAll("&amp;","&")))].filter(u=>official(u,"svs"));
    const hit=body.indexOf(item.wanted);
    console.log("OFFICIAL_SOURCE "+JSON.stringify({slug:item.slug,type:item.type,wanted:item.wanted,found:hit>=0,urls:urls.filter(x=>x.includes(item.wanted)),context:hit<0?"":body.slice(Math.max(0,hit-120),hit+240)}));
    return;
  }
  if(item.type==="nps"){
    const {body}=await fetchPage("https://www.nps.gov/media/video/view.htm?id="+item.uuid);
    const snippets=[];
    const search=/download|https?:\/\/[^\s"'<>]{10,200}\.mp4|videoUrl|fileUrl|streamUrl|mp4|npgallery/ig;
    let m;while((m=search.exec(body))&&snippets.length<16){snippets.push(body.slice(Math.max(0,m.index-100),Math.min(body.length,m.index+200)).replace(/\s+/g," ").slice(0,300))}
    console.log("OFFICIAL_SOURCE "+JSON.stringify({slug:item.slug,type:item.type,id:item.uuid,htmlBytes:body.length,snippets}));
  }
 }catch(e){console.log("OFFICIAL_ERROR "+JSON.stringify({slug:item.slug,error:String(e.message||e).slice(0,180)}))}
}
(async()=>{for(const item of entries)await scan(item)})().catch(e=>{console.error(e);process.exitCode=1});
})();
