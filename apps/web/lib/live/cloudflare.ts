type CloudflareLiveInput = {
  uid: string;
  status?: string;
  rtmps?: { url?: string; streamKey?: string };
  srt?: { url?: string; streamId?: string; passphrase?: string };
  recording?: { mode?: string };
};

type CloudflareResponse<T> = { success: boolean; result?: T; errors?: Array<{ message?: string }> };

function config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (!accountId || !token || !customerCode) throw new Error("Cloudflare Stream is not configured.");
  return { accountId, token, customerCode };
}

async function request<T>(path: string, init?: RequestInit) {
  const { accountId, token } = config();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({})) as CloudflareResponse<T>;
  if (!response.ok || !data.success || !data.result) throw new Error(data.errors?.map((item) => item.message).filter(Boolean).join("; ") || `Cloudflare Stream request failed (${response.status}).`);
  return data.result;
}

export function playbackUrls(uid: string) {
  const { customerCode } = config();
  const base = `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest`;
  return { hls: `${base}/video.m3u8`, dash: `${base}/video.mpd` };
}

export async function createCloudflareLiveInput(input: { name: string; recording: boolean; allowedOrigin: string; lowLatency?: boolean }) {
  const result = await request<CloudflareLiveInput>("/live_inputs", { method: "POST", body: JSON.stringify({ enabled: true, meta: { name: input.name }, preferLowLatency: Boolean(input.lowLatency), deleteRecordingAfterDays: input.recording ? 30 : undefined, recording: { mode: input.recording ? "automatic" : "off", timeoutSeconds: 0, hideLiveViewerCount: false, requireSignedURLs: false, allowedOrigins: [input.allowedOrigin] } }) });
  return { uid: result.uid, status: result.status ?? "new_configuration_accepted", playback: playbackUrls(result.uid), ingest: { rtmpsUrl: result.rtmps?.url ?? null, rtmpsKey: result.rtmps?.streamKey ?? null, srtUrl: result.srt?.url ?? null, srtStreamId: result.srt?.streamId ?? null, srtPassphrase: result.srt?.passphrase ?? null } };
}

export async function getCloudflareLiveInput(uid: string) {
  const result = await request<CloudflareLiveInput>(`/live_inputs/${encodeURIComponent(uid)}`);
  return { uid: result.uid, status: result.status ?? "unknown", playback: playbackUrls(result.uid) };
}

export async function disableCloudflareLiveInput(uid: string) {
  return request<CloudflareLiveInput>(`/live_inputs/${encodeURIComponent(uid)}`, { method: "PUT", body: JSON.stringify({ enabled: false }) });
}
