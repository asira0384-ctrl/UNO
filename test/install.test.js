import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {AppInstall,installPlatform} from '../public/install.js';

function environment() {
  const handlers={};
  return {handlers,navigator:{userAgent:'',standalone:false},isSecureContext:true,document:{readyState:'complete'},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(name,fn)=>{handlers[name]=fn;}};
}
test('install instructions distinguish iPhone, touch iPad, Android and desktop',()=>{
  for(const nav of [{userAgent:'iPhone'},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}])assert.equal(installPlatform(nav),'ios');
  assert.equal(installPlatform({userAgent:'Android'}),'android');assert.equal(installPlatform({userAgent:'Windows'}),'desktop');
});
test('an install prompt must come from the browser, can be used once, and installed state hides it',async()=>{
  const env=environment(),app=new AppInstall(()=>{},env);let shown=0,prevented=0;
  assert.equal(await app.prompt(),false);
  env.handlers.beforeinstallprompt({preventDefault(){prevented++;},prompt:async()=>{shown++;},userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(prevented,1);assert.equal(app.canPrompt,true);assert.equal(await app.prompt(),true);assert.equal(await app.prompt(),false);assert.equal(shown,1);
  env.handlers.appinstalled();assert.equal(app.installed,true);assert.equal(app.canPrompt,false);
});
test('service worker registration uses the root scope and revalidates on update',()=>{
  const env=environment();let registered;
  env.navigator.serviceWorker={register:(...args)=>{registered=args;return Promise.resolve();}};
  new AppInstall(()=>{},env).register();assert.deepEqual(registered,['/sw.js',{updateViaCache:'none'}]);
  registered=null;env.isSecureContext=false;new AppInstall(()=>{},env).register();assert.equal(registered,null);
});
async function worker() {
  const handlers={},storage=new Map(),pending=[],deleted=[];let networkFails=false,fetches=0;
  const key=req=>typeof req==='string'?req:req.url;
  const cache={addAll:async urls=>{for(const url of urls)storage.set(url,new Response(url));},put:async(req,res)=>{storage.set(key(req),res);}};
  const caches={open:async()=>cache,match:async req=>storage.get(key(req)),keys:async()=>['uno-party-shell-v1.4','another-app'],delete:async name=>{deleted.push(name);return true;}};
  const context={self:{location:{origin:'https://game.test'},addEventListener:(name,fn)=>{handlers[name]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches,URL,Response,fetch:async()=>{fetches++;if(networkFails)throw Error('offline');return new Response('fresh');}};
  vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  async function lifecycle(name){pending.length=0;handlers[name]({waitUntil:p=>pending.push(p)});await Promise.all(pending);}
  async function request(path,mode='cors',range=false){let response;const req={url:'https://game.test'+path,method:'GET',mode,headers:new Headers(range?{range:'bytes=0-99'}:{})};handlers.fetch({request:req,respondWith:p=>{response=p;},waitUntil:p=>pending.push(p)});const result=await response;await Promise.all(pending);return result;}
  return {storage,deleted,lifecycle,request,fail:()=>{networkFails=true;},fetches:()=>fetches};
}
test('offline launch has a styled fallback; activation only removes this app old caches',async()=>{
  const w=await worker();await w.lifecycle('install');assert.ok(w.storage.has('/offline.html'));assert.ok(w.storage.has('/offline.css'));
  await w.lifecycle('activate');assert.deepEqual(w.deleted,['uno-party-shell-v1.4']);w.fail();const response=await w.request('/?room=PRIVATE','navigate');assert.equal(await response.text(),'/offline.html');assert.equal(w.storage.has('https://game.test/?room=PRIVATE'),false);
});
test('live sockets, health checks and partial media bypass caching; scripts use the network first',async()=>{
  const w=await worker();assert.equal(await w.request('/socket.io/?token=private'),undefined);assert.equal(await w.request('/health'),undefined);assert.equal(await w.request('/assets/audio/scene-1.mp3','cors',true),undefined);assert.equal(w.fetches(),0);
  w.storage.set('https://game.test/app.js?v=1.5',new Response('old'));
  assert.equal(await (await w.request('/app.js?v=1.5')).text(),'fresh');
});
