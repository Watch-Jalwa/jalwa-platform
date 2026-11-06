/**
 * Staging-only wave-5: recover wave4 leftovers for #157.
 * Fixes invalid source_audio kind (use source_video), retries Commons audio + VHS,
 * and requeues stuck Sintel / Tears of Steel encodes. HOLD items excluded.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const WAVE5 = [
  // media_asset_kind enum has source_video (not source_audio); audio sources use source_video + audio mime.
  { slug: "huamei-bird-calling-cc0", file: "Upbeat_huamei_bird_calling.oga", mime: "audio/ogg", kind: "source_video", source: "commons" },
  { slug: "house-sparrow-tschilp-cc0", file: "Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga", mime: "audio/ogg", kind: "source_video", source: "commons" },
  { slug: "abrasive-bird-debate-cc0", file: "Abrasive_sounding_bird_debate.oga", mime: "audio/ogg", kind: "source_video", source: "commons" },
  { slug: "vhs-static-cc0-clip", file: "FREE_real_VHS_static.webm", mime: "video/webm", kind: "source_video", source: "commons" },
  {
    slug: "tears-of-steel",
    file: "tears_of_steel_720p.mov",
    mime: "video/quicktime",
    kind: "source_video",
    source: "url",
    url: "https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov",
  },
  {
    slug: "sintel",
    file: "Sintel.2010.720p.mkv",
    mime: "video/x-matroska",
    kind: "source_video",
    source: "url",
    url: "https://download.blender.org/demo/movies/Sintel.2010.720p.mkv.zip",
    zip: true,
  },
];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function r2Client() {
  const accountId = required("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function incomingBucket() {
  return process.env.R2_INCOMING_BUCKET?.trim() || required("R2_BUCKET");
}

function downloadUrl(item) {
  if (item.source === "url" && item.url) return item.url;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(item.file)}`;
}

async function downloadSource(item, target) {
  const localDir = process.env.WAVE5_MEDIA_DIR?.trim();
  if (localDir) {
    await pipeline(createReadStream(join(localDir, item.file)), createWriteStream(target));
    return;
  }
  const response = await fetch(downloadUrl(item), {
    redirect: "follow",
    headers: { "user-agent": "JalwaStagingIngest/1.0 (wave5; staging live-test)" },
  });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${item.file}: HTTP ${response.status}`);
  await pipeline(response.body, createWriteStream(target));
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function uploadIncoming(client, key, path, mime) {
  const body = createReadStream(path);
  const size = (await stat(path)).size;
  await client.send(new PutObjectCommand({
    Bucket: incomingBucket(),
    Key: key,
    Body: body,
    ContentType: mime,
    ContentLength: size,
  }));
  return size;
}

async function publishReady(pool, slug) {
  const { rows } = await pool.query(
    `select ci.id, a.id as asset_id, a.status
     from content_items ci
     left join lateral (
       select id, status from media_assets where content_id = ci.id order by created_at desc limit 1
     ) a on true
     where ci.slug = $1`,
    [slug],
  );
  const row = rows[0];
  if (!row?.asset_id || row.status !== "ready") return { slug, status: row?.status || "missing" };

  await pool.query("begin");
  try {
    await pool.query("select set_config('request.jwt.claim.role','service_role',true)");
    await pool.query("set local role service_role");
    await pool.query(
      `update playback_sources set is_primary=false, is_available=false where content_id=$1 and media_asset_id is distinct from $2`,
      [row.id, row.asset_id],
    );
    await pool.query(
      `update playback_sources
       set is_primary=true, is_available=true, status='active', disabled_at=null, disabled_reason=null
       where content_id=$1 and media_asset_id=$2`,
      [row.id, row.asset_id],
    );
    await pool.query(
      `update media_assets set is_available=true, disabled_at=null, disabled_reason=null where id=$1`,
      [row.asset_id],
    );
    await pool.query(
      `update content_items
       set status='published', publish_at=coalesce(publish_at, now()), unpublish_at=null,
           is_available=true, disabled_at=null, disabled_reason=null, updated_at=now()
       where id=$1`,
      [row.id],
    );
    await pool.query(
      `insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
       values (null, 'content_published', 'content_item', $1, $2::jsonb)`,
      [row.id, JSON.stringify({ slug, wave: "live-test-50-wave5", scope: "staging_only" })],
    );
    await pool.query("commit");
    return { slug, status: "published" };
  } catch (error) {
    await pool.query("rollback");
    return { slug, status: "publish_failed", error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const s3 = r2Client();
  const work = await mkdtemp(join(tmpdir(), "jalwa-wave5-"));
  const results = [];

  try {
    for (const item of WAVE5) {
      const { rows } = await pool.query(
        `select ci.id, ci.slug, ci.content_type, ci.duration_seconds, ci.hosting_mode, ci.status,
                rr.status as rights_status
         from content_items ci
         join rights_records rr on rr.content_id = ci.id
         where ci.slug = $1
         order by case rr.status when 'approved' then 0 else 1 end, rr.updated_at desc
         limit 1`,
        [item.slug],
      );
      const row = rows[0];
      if (!row) {
        results.push({ slug: item.slug, status: "missing_content" });
        continue;
      }
      if (row.rights_status !== "approved") {
        results.push({ slug: item.slug, status: "rights_not_approved" });
        continue;
      }
      if (row.hosting_mode !== "self_host_open" && row.hosting_mode !== "self_host_owned") {
        results.push({ slug: item.slug, status: "not_self_host" });
        continue;
      }

      const existing = await pool.query(
        `select id, status from media_assets
         where content_id = $1 and status in ('ready','queued','processing','pending_upload')
         order by created_at desc limit 1`,
        [row.id],
      );
      if (existing.rows[0]?.status === "ready") {
        results.push({ slug: item.slug, status: "already_ready", assetId: existing.rows[0].id });
        continue;
      }
      if (existing.rows[0] && ["queued", "processing", "pending_upload"].includes(existing.rows[0].status)) {
        results.push({ slug: item.slug, status: "still_busy", assetId: existing.rows[0].id, assetStatus: existing.rows[0].status });
        continue;
      }

      try {
        const assetId = randomUUID();
        const extension = item.file.split(".").pop() || "bin";
        const storageKey = `incoming/${row.id}/${assetId}/source.${extension}`;
        const localPath = join(work, `${item.slug}.${extension}`);
        await downloadSource(item, localPath);
        const checksum = await sha256File(localPath);
        const sizeBytes = await uploadIncoming(s3, storageKey, localPath, item.mime);
        const jobType = row.content_type === "short" || row.content_type === "audio" || (row.duration_seconds != null && row.duration_seconds <= 90)
          ? "short_mp4"
          : "hls";

        await pool.query("begin");
        try {
          await pool.query("select set_config('request.jwt.claim.role','service_role',true)");
          await pool.query("set local role service_role");
          await pool.query(
            `insert into media_assets (
               id, content_id, kind, status, storage_key, mime_type, size_bytes, checksum, is_available, metadata
             ) values ($1,$2,$3,'queued',$4,$5,$6,$7,false,$8::jsonb)`,
            [
              assetId,
              row.id,
              item.kind,
              storageKey,
              item.mime,
              sizeBytes,
              checksum,
              JSON.stringify({
                original_filename: item.file,
                pipeline: jobType,
                source: item.source === "url" ? item.url : "wikimedia_commons",
                wave: "live-test-50-wave5",
              }),
            ],
          );
          await pool.query(
            `insert into media_jobs (media_asset_id, job_type, status)
             values ($1, $2::public.media_job_type, 'queued')`,
            [assetId, jobType],
          );
          await pool.query("commit");
        } catch (error) {
          await pool.query("rollback");
          throw error;
        }

        results.push({ slug: item.slug, status: "queued", assetId, sizeBytes, jobType });
      } catch (error) {
        results.push({
          slug: item.slug,
          status: "ingest_failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const deadline = Date.now() + Number(process.env.WAVE5_WAIT_MS || 90 * 60 * 1000);
    while (Date.now() < deadline) {
      const { rows } = await pool.query(
        `select ci.slug, a.status
         from content_items ci
         join media_assets a on a.content_id = ci.id
         where ci.slug = any($1::text[])
         order by a.created_at desc`,
        [WAVE5.map((item) => item.slug)],
      );
      const latest = new Map();
      for (const row of rows) if (!latest.has(row.slug)) latest.set(row.slug, row.status);
      const pending = WAVE5.map((item) => item.slug).filter((slug) => {
        const status = latest.get(slug);
        return status === "queued" || status === "processing" || status === "pending_upload";
      });
      if (!pending.length) break;
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }

    const publish = [];
    for (const item of WAVE5) publish.push(await publishReady(pool, item.slug));

    console.log(JSON.stringify({ mode: "wave5", queued: results, publish }, null, 2));
  } finally {
    await rm(work, { recursive: true, force: true });
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
