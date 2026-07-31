import { timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { getLiveSourceDefinition } from "@/lib/live-sources/registry";
import { checkLiveSource } from "@/lib/live-sources/security";
import { verifyProcessedObject } from "@/lib/media/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Source = { id: string; provider: string; provider_content_id: string | null; embed_url: string | null; media_url: string | null; external_url: string | null };
type LiveConfig = { playback_source_id: string; source_key: string; next_review_at: string | null; enabled: boolean };

function validSecret(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}

function privateIp(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped?.[1] ? privateIpv4(mapped[1]) : false;
  }
  return true;
}

async function assertPublicHttps(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Source URL must use public HTTPS.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Private source host is not allowed.");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => privateIp(entry.address))) throw new Error("Source host resolves to a private or reserved address.");
  return url;
}

async function safeHttpCheck(initialUrl: string, method: "GET" | "HEAD" = "HEAD") {
  let url = await assertPublicHttps(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: { "user-agent": "Jalwa-Source-Monitor/3.0", ...(method === "GET" ? { range: "bytes=0-0" } : {}) },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) return { ok: false, message: "Unsafe or excessive redirects." };
      url = await assertPublicHttps(new URL(location, url).toString());
      continue;
    }
    if ((response.status === 405 || response.status === 501) && method === "HEAD") return safeHttpCheck(url.toString(), "GET");
    return { ok: response.ok || response.status === 206, message: response.ok || response.status === 206 ? null : `HTTP ${response.status}` };
  }
  return { ok: false, message: "Source check failed." };
}

async function checkStandardSource(source: Source) {
  try {
    if (source.provider === "youtube" && source.provider_content_id) {
      return safeHttpCheck(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${source.provider_content_id}`)}&format=json`, "GET");
    }
    if (source.media_url && !/^https:\/\//i.test(source.media_url)) {
      const object = await verifyProcessedObject(source.media_url.replace(/^\/+/, ""));
      return object.sizeBytes > 0 ? { ok: true, message: null } : { ok: false, message: "Processed object is empty." };
    }
    const url = source.external_url ?? source.embed_url ?? source.media_url;
    if (!url) return { ok: false, message: "No source URL." };
    return safeHttpCheck(url);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message.slice(0, 200) : "Source check failed." };
  }
}

export async function POST(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: sources, error } = await admin.from("playback_sources").select("id,provider,provider_content_id,embed_url,media_url,external_url").eq("status", "active").limit(500);
  if (error) return NextResponse.json({ error: "Source inventory unavailable." }, { status: 500 });
  const sourceRows = (sources ?? []) as Source[];
  const ids = sourceRows.map((source) => source.id);
  const [{ data: previousRows }, { data: configRows, error: configError }] = await Promise.all([
    ids.length
      ? admin.from("playback_source_health").select("playback_source_id,consecutive_failures,last_success_at").in("playback_source_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from("live_source_configs").select("playback_source_id,source_key,next_review_at,enabled").in("playback_source_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (configError) return NextResponse.json({ error: "Live source configuration unavailable." }, { status: 500 });
  const previous = new Map((previousRows ?? []).map((row) => [row.playback_source_id, row]));
  const configs = new Map(((configRows ?? []) as LiveConfig[]).map((row) => [row.playback_source_id, row]));
  const checkedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  let cursor = 0;
  let healthy = 0;
  let unavailable = 0;
  let offAir = 0;

  async function worker() {
    while (cursor < sourceRows.length) {
      const source = sourceRows[cursor];
      cursor += 1;
      if (!source) continue;
      const config = configs.get(source.id);
      const prior = previous.get(source.id) as { consecutive_failures?: number; last_success_at?: string | null } | undefined;
      if (!config) {
        const result = await checkStandardSource(source);
        const failures = result.ok ? 0 : (prior?.consecutive_failures ?? 0) + 1;
        results.push({
          playback_source_id: source.id,
          status: result.ok ? "healthy" : failures >= 3 ? "unavailable" : "degraded",
          availability: result.ok ? "healthy" : failures >= 3 ? "unavailable" : "degraded",
          consecutive_failures: failures,
          checked_at: checkedAt,
          last_success_at: result.ok ? checkedAt : prior?.last_success_at ?? null,
          message: result.message,
          availability_reason: result.message,
          terms_review_due: false,
        });
        if (result.ok) healthy += 1; else unavailable += 1;
        continue;
      }

      const definition = getLiveSourceDefinition(config.source_key);
      const reviewDue = !config.next_review_at || new Date(config.next_review_at).getTime() <= Date.now();
      if (!config.enabled || !definition || reviewDue) {
        const reason = !config.enabled ? "Live source is disabled." : !definition ? "Live source is not in the committed allowlist." : "Live-source terms review is overdue.";
        results.push({
          playback_source_id: source.id,
          status: "unavailable",
          availability: "unavailable",
          consecutive_failures: (prior?.consecutive_failures ?? 0) + 1,
          checked_at: checkedAt,
          last_success_at: prior?.last_success_at ?? null,
          message: reason,
          availability_reason: reason,
          terms_review_due: reviewDue,
        });
        unavailable += 1;
        continue;
      }

      try {
        const result = await checkLiveSource(config.source_key);
        const completeSuccess = result.availability === "healthy" || result.availability === "off_air";
        const failures = completeSuccess ? 0 : (prior?.consecutive_failures ?? 0) + 1;
        const availability = result.availability === "unavailable" || failures >= 3 ? "unavailable" : result.availability;
        const status = completeSuccess ? "healthy" : availability === "unavailable" ? "unavailable" : "degraded";
        results.push({
          playback_source_id: source.id,
          status,
          availability,
          consecutive_failures: failures,
          checked_at: checkedAt,
          last_success_at: completeSuccess ? checkedAt : prior?.last_success_at ?? null,
          source_timestamp: result.sourceTimestamp,
          etag: result.etag,
          last_modified: result.lastModified,
          content_hash: result.contentHash,
          message: result.message,
          availability_reason: result.message,
          terms_review_due: false,
        });
        if (availability === "off_air") offAir += 1;
        else if (status === "healthy") healthy += 1;
        else unavailable += 1;
      } catch (liveError) {
        const failures = (prior?.consecutive_failures ?? 0) + 1;
        const message = liveError instanceof Error ? liveError.message.slice(0, 200) : "Provider-aware source check failed.";
        results.push({
          playback_source_id: source.id,
          status: failures >= 3 ? "unavailable" : "degraded",
          availability: failures >= 3 ? "unavailable" : "degraded",
          consecutive_failures: failures,
          checked_at: checkedAt,
          last_success_at: prior?.last_success_at ?? null,
          message,
          availability_reason: message,
          terms_review_due: false,
        });
        unavailable += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(8, Math.max(1, sourceRows.length)) }, () => worker()));
  if (results.length) {
    const { error: writeError } = await admin.from("playback_source_health").upsert(results, { onConflict: "playback_source_id" });
    if (writeError) return NextResponse.json({ error: "Source health results could not be stored." }, { status: 500 });
  }
  return NextResponse.json({ checked: sourceRows.length, healthy, offAir, unavailable, checkedAt });
}
