
const ROOT=self.registration.scope;
const PREFIX='kup-rehberim-'+encodeURIComponent(new URL(ROOT).pathname)+'-';
const CACHE=PREFIX+"9d0efcd90cee";
const ASSETS=["./","index.html","main-X65W7XYC.js","manifest.webmanifest","polyfills-IVRE6R6P.js","solver.worker.js","styles-VY3HKCKY.css","icons/cube-192.png","icons/cube-512.png","icons/cube-180.png"].map(asset=>new URL(asset,ROOT).href);
const INDEX=new URL('index.html',ROOT).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'&&(url.href===ROOT||url.href===INDEX)){
    event.respondWith((async()=>{try{return await fetch(request);}catch{return await caches.match(INDEX)||Response.error();}})());return;
  }
  if(ASSETS.includes(url.href))event.respondWith((async()=>{const cached=await caches.match(request);return cached||fetch(request);})());
});
