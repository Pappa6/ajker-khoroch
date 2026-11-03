// Ajker Khoroch service worker.
// 1) Receive a statement file shared from another app (PhonePe, Gmail, Files) and hand it to the app page.
//    Nothing is sent anywhere; the file stays on the phone.
// 2) Keep the app page and the PDF/Excel reading libraries on the phone, so everything works with no internet
//    after the first visit. The page itself is always fetched fresh when there is internet, so updates arrive straight away.
const SHARE_CACHE = "ajker-khoroch-share";
const APP_CACHE = "ajker-khoroch-app-v1";
const LIBS = ["lib/xlsx.full.min.js", "lib/pdf.min.js", "lib/pdf.worker.min.js"];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(APP_CACHE).then(c => Promise.all(LIBS.map(u => c.add(u).catch(() => {})))));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) { if (k.startsWith("ajker-khoroch-app-") && k !== APP_CACHE) await caches.delete(k); }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const req = event.request, url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get("statement");
        if (file && file.size) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put("shared-statement", new Response(file, {
            headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name || "statement") }
          }));
        }
      } catch (_) {}
      return Response.redirect("./?shared=1", 303);
    })());
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/lib/")) {
    // versioned library files: cache first
    event.respondWith(caches.open(APP_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (req.mode === "navigate") {
    // the page: network first (fresh updates), saved copy only when there is no internet
    event.respondWith((async () => {
      const c = await caches.open(APP_CACHE);
      try {
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (e) {
        const hit = (await c.match(req, { ignoreSearch: true })) || (await c.match("./", { ignoreSearch: true }));
        if (hit) return hit;
        throw e;
      }
    })());
  }
});
