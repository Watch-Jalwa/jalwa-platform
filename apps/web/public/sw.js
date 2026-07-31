const SHELL_CACHE = "jalwa-shell-v2";
const OFFLINE_CACHE = "jalwa-offline-v2";
const OFFLINE_FALLBACK = "/offline-fallback.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_FALLBACK, "/manifest.webmanifest"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => (key.startsWith("jalwa-shell-") && key !== SHELL_CACHE) || key === "jalwa-offline-v1")
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/offline-media/")) {
    event.respondWith((async () => {
      const match = url.pathname.match(/^\/offline-media\/(\d{10})-/);
      if (!match) return new Response("Invalid offline item", { status: 400 });
      const cache = await caches.open(OFFLINE_CACHE);
      if (Number(match[1]) <= Math.floor(Date.now() / 1000)) {
        await cache.delete(request);
        return new Response("Offline item expired", { status: 410 });
      }
      return (await cache.match(request)) || new Response("Offline item missing", { status: 404 });
    })());
    return;
  }

  // Never persist navigations. Account, billing, history, Studio, and personalized
  // catalogue pages can contain private data and must remain network-only.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () => (await caches.match(OFFLINE_FALLBACK)) || new Response("Offline", { status: 503 })));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".png") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".webp")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
  }
});
