import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Exercise the operator's actual local-media validator without loading its live database entrypoint.
const source = readFileSync(new URL("./publish.mjs", import.meta.url), "utf8");
const start = source.indexOf("function inspectVideo(");
const end = source.indexOf("async function decodeMedia(");
assert(start >= 0 && end > start, "Media validator boundary changed");
const validatorSource = source.slice(start, end);
function inspector(aspect) {
  return Function("assert", "execFileSync", "sourceAspect", validatorSource + "\nreturn inspectVideo;")(
    assert, execFileSync, aspect,
  );
}

function encode(args) {
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args], {
    timeout:30000,
    stdio:["ignore", "ignore", "pipe"],
  });
}

test("retained outputs require decodable audio/video, reviewed duration and original aspect", () => {
  const directory = mkdtempSync(join(tmpdir(), "jalwa-retained-validator-"));
  try {
    const video = join(directory, "sample.mp4");
    const silent = join(directory, "silent.mp4");
    const segment = join(directory, "sample.ts");
    encode([
      "-f", "lavfi", "-i", "testsrc2=size=640x480:rate=2",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "45",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "35",
      "-c:a", "aac", "-b:a", "32k", video,
    ]);
    encode(["-i", video, "-an", "-c:v", "copy", silent]);
    encode([
      "-f", "lavfi", "-i", "color=c=blue:s=1280x544:r=24",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "2",
      "-vf", "scale=848:360", "-c:v", "libx264", "-preset", "ultrafast",
      "-c:a", "aac", "-f", "mpegts", segment,
    ]);

    assert.equal(inspector(4 / 3)(video, 45).duration, 45);
    assert.equal(inspector(1280 / 544)(segment).height, 360);
    assert.throws(() => inspector(4 / 3)(video, 44), /Output duration mismatch/);
    assert.throws(() => inspector(1280 / 544)(video, 45), /Source display aspect was changed/);
    assert.throws(() => inspector(4 / 3)(silent, 45), /Source audio was lost/);
  } finally {
    rmSync(directory, {recursive:true, force:true});
  }
});
