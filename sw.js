const CACHE = "flight-films-v4";
const POSTERS = "flight-films-posters";
const FILES = ["./", "index.html", "airnz.html", "ba.html", "styles.css", "app.js",
  "airnz-data.js", "ba-data.js", "manifest.webmanifest", "icon-180.png", "icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== POSTERS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first (so updates arrive), cache fallback (so it works offline)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // Posters: cache first so they show offline
  if (u.hostname === "upload.wikimedia.org") {
    e.respondWith(caches.open(POSTERS).then(c => c.match(e.request.url).then(hit => hit ||
      fetch(e.request.url).then(res => { if (res.ok) c.put(e.request.url, res.clone()); return res; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
