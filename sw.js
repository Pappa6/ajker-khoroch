// Ajker Khoroch service worker.
// Its only job: receive a statement file shared from another app (PhonePe, Gmail, Files)
// and hand it to the app page. Nothing is sent anywhere; the file stays on the phone.
const SHARE_CACHE = "ajker-khoroch-share";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
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
  }
  // every other request goes to the network as usual, so updates arrive straight away
});
