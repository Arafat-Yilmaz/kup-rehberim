const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
(async()=>{
  const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.lang,'tr');
  for(const icon of manifest.icons){const bytes=fs.readFileSync('public/'+icon.src);const [w,h]=icon.sizes.split('x').map(Number);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);}
  console.log('PASS installable manifest and real icon dimensions');
  // Exercise the actual generated worker against a minimal browser contract.
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'cube-pwa-'));
  fs.writeFileSync(path.join(fixture,'index.html'),'<html><app-root></app-root></html>');
  fs.writeFileSync(path.join(fixture,'main-example.js'),'/* example application */');
  fs.writeFileSync(path.join(fixture,'solver.worker.js'),'/* example solver */');
  fs.copyFileSync('public/manifest.webmanifest',path.join(fixture,'manifest.webmanifest'));
  fs.cpSync('public/icons',path.join(fixture,'icons'),{recursive:true});
  execFileSync(process.execPath,['scripts/build-pwa.mjs',fixture],{stdio:'pipe'});
  for(const scope of ['https://cube.test/','https://cube.test/kup-rehberim/']){
  const prefix='kup-rehberim-'+encodeURIComponent(new URL(scope).pathname)+'-';
  const index=new URL('index.html',scope).href;
  const handlers={},deleted=[],cached=[];
  const offlineDocument={marker:'offline application shell'};
  const context={URL,Response,self:{registration:{scope},location:{origin:'https://cube.test'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async assets=>cached.push(...assets)}),keys:async()=>[prefix+'old','kup-rehberim-other-app','unrelated-app'],delete:async name=>deleted.push(name),match:async name=>name===index?offlineDocument:null},fetch:async()=>{throw Error('offline');}};
  vm.runInNewContext(fs.readFileSync(path.join(fixture,'service-worker.js'),'utf8'),context);
  let operation;handlers.install({waitUntil:p=>operation=p});await operation;
  assert.ok(cached.includes(index));assert.ok(cached.includes(new URL('solver.worker.js',scope).href));assert.ok(cached.every(p=>p.startsWith(scope)));
  handlers.activate({waitUntil:p=>operation=p});await operation;
  assert.deepEqual(deleted,[prefix+'old']);
  let response;handlers.fetch({request:{method:'GET',url:scope,mode:'navigate'},respondWith:p=>response=p});assert.equal(await response,offlineDocument);
  let intercepted=false;handlers.fetch({request:{method:'POST',url:'https://cube.test/private',mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  handlers.fetch({request:{method:'GET',url:'https://cube.test/auth/callback',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  handlers.fetch({request:{method:'GET',url:'https://other.test/file.js',mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  console.log('PASS offline navigation fallback, app-only caching and unrelated-cache protection');
  }
  fs.rmSync(fixture,{recursive:true,force:true});
})().catch(error=>{console.error(error);process.exitCode=1;});
