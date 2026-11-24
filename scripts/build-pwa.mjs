import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const dist=path.resolve(process.argv[2]??'dist');
const files=fs.readdirSync(dist).filter(n=>/\.(js|css|webmanifest)$/.test(n)&&n!=='service-worker.js');
const assets=['./','index.html',...files,'icons/cube-192.png','icons/cube-512.png','icons/cube-180.png'];
const hash=crypto.createHash('sha256');
for(const name of assets.filter(n=>n!=='./'))hash.update(fs.readFileSync(path.join(dist,name)));
const version=hash.digest('hex').slice(0,12);
fs.writeFileSync(path.join(dist,'service-worker.js'),`
const ROOT=self.registration.scope;
const PREFIX='kup-rehberim-'+encodeURIComponent(new URL(ROOT).pathname)+'-';
const CACHE=PREFIX+${JSON.stringify(version)};
const ASSETS=${JSON.stringify(assets)}.map(asset=>new URL(asset,ROOT).href);
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
`);
console.log('PWA shell prepared: '+version+' ('+assets.length+' assets)');
