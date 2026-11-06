// Run with the exact deployed apps/worker/src/media.mjs file as the first argument.
// Storage imports are excluded because these fixtures exercise FFmpeg arguments and process execution only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

assert(process.argv[2], "Pass the exact deployed worker media.mjs path");
const original = await readFile(process.argv[2], "utf8");
const source = original.replace(/^import \{ downloadObject, mediaBackend, uploadDirectory, uploadJsonMarker \} from "\.\/storage\.mjs";$/m, "");
assert.notEqual(source, original, "Expected one storage dependency import");
const media = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const root = await mkdtemp(join(tmpdir(), "jalwa-repair-regression-"));
const results = [];

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-nostdin", "-y", "-v", "error", ...args], {
    timeout:90000, stdio:["ignore", "ignore", "pipe"],
  });
}

function probe(path) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe,crypto,data",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", path], {
    encoding:"utf8", timeout:30000,
  }));
}

try {
  ffmpeg(["-f", "lavfi", "-i", "color=c=gray:s=640x480:r=24", "-f", "lavfi", "-i",
    "sine=frequency=440:sample_rate=48000", "-t", "46", "-c:v", "libvpx-vp9", "-threads", "2",
    "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", join(root, "vhs.webm")]);
  const shortArgs = media.buildShortArgs(join(root, "vhs.webm"), join(root, "vhs.mp4"));
  shortArgs.splice(shortArgs.length-1, 0, "-t", "45", "-threads", "2");
  await media.run("ffmpeg", shortArgs, 90000);
  const vhs = probe(join(root, "vhs.mp4"));
  const shortVideo = vhs.streams.find(stream=>stream.codec_type==="video");
  assert.equal(shortVideo.width, 640);
  assert.equal(shortVideo.height, 480);
  assert.equal(shortVideo.codec_name, "h264");
  assert(Math.abs(Number(vhs.format.duration)-45)<0.1);
  assert.equal(vhs.streams.find(stream=>stream.codec_type==="audio")?.codec_name,"aac");
  results.push({fixture:"VHS-shaped VP9 and Opus source",check:"45-second excerpt",durationSeconds:Number(vhs.format.duration),
    width:shortVideo.width,height:shortVideo.height,audioCodec:"aac",pass:true});

  ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=1280x544:r=24", "-f", "lavfi", "-i",
    "anullsrc=channel_layout=5.1:sample_rate=48000", "-t", "8", "-c:v", "libx264", "-threads", "2",
    "-preset", "ultrafast", "-c:a", "ac3", "-b:a", "640k", "-metadata:s:a:0", "language=eng", join(root,"sintel.mkv")]);
  for (const size of [360,480,720]) await mkdir(join(root,`${size}p`));
  const hlsArgs = media.buildHlsArgs(join(root,"sintel.mkv"),root,true);
  hlsArgs.splice(hlsArgs.length-1,0,"-threads:v:0","2","-threads:v:1","2","-threads:v:2","2","-filter_complex_threads","2");
  await media.run("ffmpeg",hlsArgs,90000);
  for (const size of [360,480,720]) {
    const output = probe(join(root,`${size}p/index.m3u8`));
    const video = output.streams.find(stream=>stream.codec_type==="video");
    assert.equal(video.height,size);
    assert.equal(video.codec_name,"h264");
    assert(Math.abs(video.width/video.height-1280/544)<0.015);
    assert(Math.abs(Number(output.format.duration)-8)<1.5);
    assert.equal(output.streams.find(stream=>stream.codec_type==="audio")?.codec_name,"aac");
    const playlist=await readFile(join(root,`${size}p/index.m3u8`),"utf8");
    assert(playlist.startsWith("#EXTM3U") && playlist.includes("#EXT-X-ENDLIST"));
    results.push({fixture:"Sintel-shaped H264 and English AC3 5.1 source",check:`${size}p HLS`,
      durationSeconds:Number(output.format.duration),width:video.width,height:video.height,audioCodec:"aac",pass:true});
  }
  console.log(JSON.stringify({builderSourceSha256:createHash("sha256").update(original).digest("hex"),
    checkedAt:new Date().toISOString(),results},null,2));
} finally {
  await rm(root,{recursive:true,force:true});
}
