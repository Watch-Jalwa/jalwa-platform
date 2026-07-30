const CACHE = "jalwa-shell-v1";
const OFFLINE = "/offline-fallback.html";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", OFFLINE, "/manifest.webmanifest"])));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("jalwa-shell-") && key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/offline-media/")) {
    event.respondWith(caches.match(request).then((cached) => cached || new Response("Offline item missing", { status: 404 })));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE))));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".png") || url.pathname.endsWith(".svg")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; })));
  }
});
