const CACHE="momentumvelo-v2";
const OFFLINE="/";
const CORE=["/","/index.html","/styles.css","/site.js","/panel.html","/panel.css","/panel.js","/login.html","/premium.html","/manifest.webmanifest","/pwa.js"];

self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(CORE.map(url=>cache.add(url)))).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;

 if(event.request.mode==="navigate"){
   event.respondWith(fetch(event.request).then(response=>{
     if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
     return response;
   }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(OFFLINE))));
   return;
 }

 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
   if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
   return response;
 })));
});