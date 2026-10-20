// Service worker : l'application reste ouvrable sans réseau (mode terrain).
// Pages : réseau d'abord, cache sinon. Fichiers statiques : cache d'abord.
const CACHE = "salles-propres-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./favicon.svg", "./manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copie)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((trouve) => trouve || fetch(req).then((r) => {
    if (r.ok) { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
    return r;
  })));
});
