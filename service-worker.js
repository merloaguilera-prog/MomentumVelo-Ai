"use strict";
const CACHE = "momentumvelo-public-v1";
const PAGES = new Set(["/mercados", "/radar", "/practica", "/comparar", "/offline"]);
const ASSETS = new Set([
  "/panel.css", "/practica-promos.css", "/mercados.css", "/neon.css", "/styles.css",
  "/practica.css", "/comparar.css", "/pwa.css", "/pwa.js", "/workspace-core.js",
  "/mercados-global.js", "/mercados.js", "/detector-core.js", "/detector-chart-core.js",
  "/detector-chart.js", "/mercados-detector.js", "/radar-core.js", "/radar.js",
  "/practica-core.js", "/practica.js", "/practica-review-core.js", "/practica-review.js",
  "/comparador-core.js", "/comparar.js", "/site.js",
  "/images/practica-neon.webp", "/images/diario-neon.webp",
  "/icons/icon-192.png", "/icons/icon-512.png"
]);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...PAGES, ...ASSETS])));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith("momentumvelo-public-") && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // Authentication, payments, APIs, user files and third-party quotes are never cached.
  if (request.method !== "GET" || url.origin !== self.location.origin
      || (!PAGES.has(url.pathname) && !ASSETS.has(url.pathname))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.pathname;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(key, response.clone());
      return response;
    } catch (error) {
      const saved = await cache.match(key);
      if (saved) return saved;
      if (request.mode === "navigate") return cache.match("/offline");
      throw error;
    }
  })());
});
