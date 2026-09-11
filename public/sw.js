const BASE = "/sleep-log";
const SHELL_CACHE = "sleep-log-shell-v4";
const RUNTIME_CACHE = "sleep-log-runtime-v4";
const KEEP = [SHELL_CACHE, RUNTIME_CACHE];

// Every route Expo Router exports, so a deep link opens offline too. Both the
// pretty and the .html form are listed: GitHub Pages serves the first, a plain
// static server the second.
const ROUTES = ["history", "analysis", "settings", "record"];
const SHELL = [
  BASE + "/",
  ...ROUTES.map((route) => `${BASE}/${route}`),
  ...ROUTES.map((route) => `${BASE}/${route}.html`),
  BASE + "/manifest.json",
  BASE + "/icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // One bad URL must not fail the whole install.
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Navigations: network first, so a redeploy is picked up immediately. The
// previous cache-first version kept serving stale HTML that pointed at bundle
// hashes the server had already deleted.
function handleNavigation(request) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match(BASE + "/"))
    );
}

// Static assets are content-hashed by Expo, so cache-first is safe and makes
// the app start with no network at all.
function handleAsset(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleAsset(request));
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
