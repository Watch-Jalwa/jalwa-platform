/**
 * Staging-only wave-1 ingest for small open-licence live-test assets.
 * Downloads exact Wikimedia Commons files, uploads to R2 incoming/, queues media jobs,
 * waits for worker completion, enables availability, and publishes.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const WAVE1 = [
  { slug: "mossy-tree-cc0", file: "Mossy_Tree_CC0.webm", mime: "video/webm", kind: "source_video" },
  { slug: "baking-cookies-cc0", file: "Baking_cookies.ogv", mime: "video/ogg", kind: "source_video" },
  { slug: "ocean-surface-waves-cc0", file: "Ocean_surface_waves.ogv", mime: "video/ogg", kind: "source_video" },
  { slug: "tiny-waterfall-cc0", file: "Tiny_Water_Fall-HD.ogv", mime: "video/ogg", kind: "source_video" },
  { slug: "tree-trimmer-cc0", file: "Tree_trimmer.webm", mime: "video/webm", kind: "source_video" },
  { slug: "counting-chisenbop-cc0", file: "Counting_from_1_to_20_in_Chisenbop.webm", mime: "video/webm", kind: "source_video" },
  { slug: "vanellus-vanellus-cc0", file: "Vanellus_vanellus.ogv", mime: "video/ogg", kind: "source_video" },
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

async function downloadCommons(file, target) {
  const localDir = process.env.WAVE1_MEDIA_DIR?.trim();
  if (localDir) {
    const localPath = join(localDir, file);
    await pipeline(createReadStream(localPath), createWriteStream(target));
    return;
  }
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "JalwaStagingIngest/1.0" } });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${file}: HTTP ${response.status}`);
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

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const s3 = r2Client();
  const work = await mkdtemp(join(tmpdir(), "jalwa-wave1-"));
  const results = [];

  try {
    for (const item of WAVE1) {
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

      try {
        const assetId = existing.rows[0]?.id || randomUUID();
        const extension = item.file.split(".").pop() || "bin";
        const storageKey = `incoming/${row.id}/${assetId}/source.${extension}`;
        const localPath = join(work, `${item.slug}.${extension}`);
        await downloadCommons(item.file, localPath);
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
             ) values ($1,$2,$3,'queued',$4,$5,$6,$7,false,$8::jsonb)
             on conflict (id) do update set
               status='queued', storage_key=excluded.storage_key, mime_type=excluded.mime_type,
               size_bytes=excluded.size_bytes, checksum=excluded.checksum, is_available=false,
               metadata=excluded.metadata`,
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
                source: "wikimedia_commons",
                wave: "live-test-50-wave1",
              }),
            ],
          );
          await pool.query(
            `insert into media_jobs (media_asset_id, job_type, status)
             select $1, $2::public.media_job_type, 'queued'
             where not exists (
               select 1 from media_jobs where media_asset_id=$1 and status in ('queued','processing')
             )`,
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

    const deadline = Date.now() + Number(process.env.WAVE1_WAIT_MS || 20 * 60 * 1000);
    while (Date.now() < deadline) {
      const { rows } = await pool.query(
        `select ci.slug, a.status
         from content_items ci
         join media_assets a on a.content_id = ci.id
         where ci.slug = any($1::text[])
         order by a.created_at desc`,
        [WAVE1.map((item) => item.slug)],
      );
      const latest = new Map();
      for (const row of rows) if (!latest.has(row.slug)) latest.set(row.slug, row.status);
      const pending = WAVE1.map((item) => item.slug).filter((slug) => latest.get(slug) !== "ready" && latest.get(slug) !== "failed");
      if (!pending.length) break;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    const publish = [];
    for (const item of WAVE1) {
      const { rows } = await pool.query(
        `select ci.id, a.id as asset_id, a.status
         from content_items ci
         left join lateral (
           select id, status from media_assets where content_id = ci.id order by created_at desc limit 1
         ) a on true
         where ci.slug = $1`,
        [item.slug],
      );
      const row = rows[0];
      if (!row?.asset_id || row.status !== "ready") {
        publish.push({ slug: item.slug, status: row?.status || "missing" });
        continue;
      }

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
          `update media_assets
           set is_available=true, disabled_at=null, disabled_reason=null
           where id=$1`,
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
          [row.id, JSON.stringify({ slug: item.slug, wave: "live-test-50-wave1", scope: "staging_only" })],
        );
        await pool.query("commit");
        publish.push({ slug: item.slug, status: "published" });
      } catch (error) {
        await pool.query("rollback");
        publish.push({ slug: item.slug, status: "publish_failed", error: error instanceof Error ? error.message : String(error) });
      }
    }

    console.log(JSON.stringify({ mode: "wave1", queued: results, publish }, null, 2));
  } finally {
    await rm(work, { recursive: true, force: true });
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
