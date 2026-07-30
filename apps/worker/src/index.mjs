const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);

export function buildHealth() {
  return { service: "jalwa-worker", status: "ready", version: process.env.GIT_SHA ?? "local" };
}

async function tick() {
  console.log(JSON.stringify({ ...buildHealth(), at: new Date().toISOString() }));
}

if (process.env.NODE_ENV !== "test") {
  await tick();
  setInterval(tick, pollIntervalMs).unref();
}
