import {readFile,readdir,stat,statfs,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const cache='/tmp/jalwa-repair-20261106/5c5f576c-d1d6-4898-9bd5-2e3616fd0001';
const evidence='/tmp/jalwa-retained-inspection-'+process.env.GITHUB_RUN_ID;
await mkdir(evidence,{recursive:true,mode:0o700});
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
    try {
      execFileSync('ffmpeg',['-nostdin','-v','warning','-xerror','-i',join(directory,segment),'-map','0:v:0','-map','0:a:0','-f','null','-'],{timeout:90000,stdio:['ignore','ignore','pipe']});
      console.log('SEGMENT_DECODE_OK',JSON.stringify({relative,segment}));
    } catch(error) {
      console.log('SEGMENT_DECODE_FAILED',JSON.stringify({relative,segment,status:error.status,signal:error.signal,stderr:error.stderr?.toString().slice(-16000),message:error.message?.slice(-2000)}));
    }
  }
  const closing=join(evidence,relative.split('/')[0]+'-closing.ts');
  await writeFile(closing,Buffer.concat(await Promise.all(segments.slice(-2).map(name=>readFile(join(directory,name))))));
  await copyFile(join(directory,segments.at(-1)),join(evidence,relative.split('/')[0]+'-tail.ts'));
  try {
    execFileSync('ffmpeg',['-nostdin','-v','warning','-xerror','-i',closing,'-map','0:v:0','-map','0:a:0','-f','null','-'],{timeout:90000,stdio:['ignore','ignore','pipe']});
    console.log('CLOSING_DECODE_OK',JSON.stringify({relative,segments:segments.slice(-2)}));
  } catch(error) {
    console.log('CLOSING_DECODE_FAILED',JSON.stringify({relative,status:error.status,signal:error.signal,stderr:error.stderr?.toString().slice(-16000)}));
  }
  console.log('CLOSING_PROBE',execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,sample_rate,channels:format=duration,start_time','-of','json',closing],{encoding:'utf8',timeout:30000}));
}
const packets=JSON.parse(execFileSync('ffprobe',['-v','error','-read_intervals','880%','-select_streams','a:0','-show_entries','packet=pts_time,duration_time','-of','json',join(cache,'source')],{encoding:'utf8',timeout:30000}));
console.log('ORIGINAL_LAST_AUDIO_PACKETS',JSON.stringify(packets.packets.slice(-3)));
