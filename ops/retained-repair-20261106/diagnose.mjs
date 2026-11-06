import {readFile,readdir,stat,statfs,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const cache='/tmp/jalwa-repair-20261106/5c5f576c-d1d6-4898-9bd5-2e3616fd0001';
const space=await statfs(cache);
console.log('WORKER_TMP_CAPACITY',JSON.stringify({capacityBytes:space.blocks*space.bsize,freeBytes:space.bavail*space.bsize}));
console.log('SOURCE_VERIFICATION',await readFile(join(cache,'source-verified.json'),'utf8'));
for(const relative of ['master.m3u8','360p/index.m3u8','480p/index.m3u8','720p/index.m3u8']) {
  const file=join(cache,'output',relative);
  const raw=await readFile(file,'utf8');
  console.log('PLAYLIST',JSON.stringify({relative,bytes:Buffer.byteLength(raw),raw}));
  if(relative==='master.m3u8')continue;
  const directory=join(cache,'output',relative.split('/')[0]);
  const segments=(await readdir(directory)).filter(name=>/^segment-\d{5}\.ts$/.test(name)).sort();
  const sizes=await Promise.all(segments.map(name=>stat(join(directory,name))));
  console.log('SEGMENTS',JSON.stringify({relative,count:segments.length,bytes:sizes.reduce((sum,s)=>sum+s.size,0),first:segments[0],last:segments.at(-1)}));
  for(const segment of [segments[0],segments.at(-1)]) {
    try {
      const probe=execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height:format=duration,start_time','-of','json',join(directory,segment)],{encoding:'utf8',timeout:30000});
      console.log('SEGMENT_PROBE',JSON.stringify({relative,segment,probe:JSON.parse(probe)}));
    } catch(error) {
      console.log('SEGMENT_INVALID',JSON.stringify({relative,segment,bytes:(await stat(join(directory,segment))).size,status:error.status}));
    }
  }
}
const evidence='/tmp/jalwa-retained-inspection-'+process.env.GITHUB_RUN_ID;
await mkdir(evidence,{recursive:true,mode:0o700});
if(space.bavail*space.bsize<50*1024*1024) {
  console.log('CREDIT_FRAMES_DEFERRED_LOW_TMP_CAPACITY');
  process.exit(0);
}
execFileSync('ffmpeg',['-nostdin','-y','-v','error','-sseof','-90','-i',join(cache,'source'),'-map','0:v:0','-an','-threads','2','-filter_threads','2','-vf','fps=1/3,scale=1280:-2','-q:v','3',join(evidence,'sintel-credit-%03d.jpg')],{timeout:90000,stdio:['ignore','ignore','pipe']});
execFileSync('ffmpeg',['-nostdin','-y','-v','error','-i','/tmp/jalwa-repair-20261106/301b706e-9bf9-437a-9506-6c1cf27754d6/output/short-720.mp4','-map','0:v:0','-frames:v','1','-q:v','3',join(evidence,'vhs-static-output.jpg')],{timeout:30000,stdio:['ignore','ignore','pipe']});
