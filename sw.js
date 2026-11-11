/* AmaySST Quiz service worker.
   Bump VERSION whenever you change this file or the FILES list.
   Only static same-site GET files and Google Fonts are cached. Nothing personal is cached:
   progress is kept in the browser's localStorage, never in this cache. */
const VERSION = "v1", SHELL = "amaysst-shell-" + VERSION, FONTS = "amaysst-fonts-v1";
const ROOT = new URL("./", self.registration.scope).href;
const FILES = ["", "index.html", "offline.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"].map(f => ROOT + f);
const HOME = [new URL(ROOT).pathname, new URL(ROOT + "index.html").pathname];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(FILES.map(async u => {
      const r = await fetch(new Request(u, { cache: "reload" }));
      if (!r.ok) throw new Error("Precache failed: " + u);
      await c.put(u, r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("amaysst-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Pages: network first (so new deploys show up straight away), cached copy if offline or slow.
async function page(req) {
  const c = await caches.open(SHELL), home = HOME.includes(new URL(req.url).pathname);
  try {
    const net = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, 4000))]);
    if (home && net.ok && net.type === "basic") { c.put(ROOT, net.clone()); c.put(ROOT + "index.html", net.clone()); }
    return net;
  } catch (_) {
    return (home && ((await c.match(ROOT)) || (await c.match(ROOT + "index.html")))) || (await c.match(ROOT + "offline.html")) || Response.error();
  }
}

// Static files and fonts: serve the cached copy instantly and refresh it in the background.
async function swr(e, name) {
  const c = await caches.open(name), hit = await c.match(e.request);
  const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone()); return r; }).catch(() => hit);
  e.waitUntil(net.catch(() => {}));
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || r.headers.has("authorization")) return;
  const u = new URL(r.url);
  if (r.mode === "navigate") { if (u.href.startsWith(ROOT)) e.respondWith(page(r)); return; }
  if (u.origin === location.origin) { if (FILES.includes(u.origin + u.pathname)) e.respondWith(swr(e, SHELL)); return; }
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") e.respondWith(swr(e, FONTS));
});
