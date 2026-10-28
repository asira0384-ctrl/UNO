import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGameServer } from '../server.js';

const request=(socket,name,data={})=>new Promise((resolve,reject)=>socket.timeout(3000).emit(name,data,(err,r)=>err?reject(err):resolve(r)));
async function connect(url) {
  const s=io(url,{reconnection:false,transports:['websocket'],forceNew:true});
  s.view=null;s.on('state',v=>{s.view=v;});
  await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;
}
async function until(fn) {
  const start=Date.now();while(!fn()){if(Date.now()-start>2500)throw new Error('state timeout');await new Promise(r=>setTimeout(r,10));}
}

test('real clients join, play, keep hands private, reconnect, and restore after restart',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'uno-party-test-'));
  let server=await createGameServer({dataDir,botDelay:100000,dealDelay:0});let clients=[];
  t.after(async()=>{for(const c of clients)c.disconnect();await server.close();await rm(dataDir,{recursive:true,force:true});});
  const address=await server.listen(0,'127.0.0.1'),url=`http://127.0.0.1:${address.port}`;
  const response=await fetch(url+'/health');assert.deepEqual(await response.json(),{ok:true});
  const html=await fetch(url+'/');assert.equal(html.status,200);assert.match(await html.text(),/UNO PARTY/);
  const music=await fetch(url+'/assets/audio/party-loop.mp3',{headers:{Range:'bytes=0-4095'}});
  assert.equal(music.status,206);assert.match(music.headers.get('content-type'),/audio\/mpeg/);assert.equal((await music.arrayBuffer()).byteLength,4096);
  const background=await fetch(url+'/assets/table-room.webp');assert.equal(background.status,200);assert.match(background.headers.get('content-type'),/image\/webp/);
  const alice=await connect(url),bob=await connect(url);clients.push(alice,bob);
  const created=await request(alice,'room:create',{name:'Alice',avatar:0});assert.equal(created.ok,true);assert.match(created.code,/^[A-Z2-9]{6}$/);
  const joined=await request(bob,'room:join',{code:created.code,name:'Bob',avatar:2});assert.equal(joined.ok,true);
  await until(()=>alice.view?.players.length===2);assert.equal((await request(bob,'game:start')).ok,false);
  assert.equal(alice.view.settings.botDifficulty,'normal');
  assert.equal((await request(bob,'room:settings',{botDifficulty:'hard'})).ok,false);
  assert.equal((await request(alice,'room:settings',{botDifficulty:'easy'})).ok,true);
  await until(()=>bob.view.settings.botDifficulty==='easy');
  assert.equal((await request(alice,'game:start')).ok,true);await until(()=>bob.view?.phase==='playing');
  assert.equal(alice.view.hand.length,7);assert.equal(bob.view.hand.length,7);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=';
  assert.equal((await request(alice,'player:profile',{name:'Alice',avatar:4,image})).ok,true);
  await until(()=>bob.view.players.find(p=>p.id===created.playerId)?.image===image);
  assert.equal((await request(alice,'player:profile',{name:'Alice',image:'data:image/svg+xml;base64,PHN2Zz4='})).ok,false);
  assert.equal(JSON.stringify(alice.view).includes(bob.view.hand[0].id),false);
  assert.equal(alice.view.players.some(p=>'token' in p||'hand' in p),false);
  const bad=await request(bob,'game:play',{cardId:bob.view.hand[0].id});assert.equal(bad.ok,false);
  const revision=alice.view.revision;
  const valid=alice.view.playableIds[0];
  assert.equal((await request(alice,valid?'game:play':'game:draw',valid?{cardId:valid,color:'blue'}:{})).ok,true);
  await until(()=>bob.view.revision>revision);assert.equal(alice.view.revision,bob.view.revision);
  const beforeReconnect=alice.view.hand.map(c=>c.id).sort();alice.disconnect();
  await until(()=>bob.view.players.find(p=>p.name==='Alice').connected===false);
  const resumed=await connect(url);clients.push(resumed);
  assert.equal((await request(resumed,'room:resume',{code:created.code,token:created.token})).ok,true);
  assert.deepEqual(resumed.view.hand.map(c=>c.id).sort(),beforeReconnect);
  assert.equal((await request(resumed,'reaction',{emoji:'🔥'})).ok,true);
  assert.equal((await request(resumed,'reaction',{emoji:'<script>'})).ok,false);
  for(const c of clients)c.disconnect();clients=[];await server.close();
  server=await createGameServer({dataDir,botDelay:100000,dealDelay:0});const nextAddress=await server.listen(0,'127.0.0.1');
  const restored=await connect(`http://127.0.0.1:${nextAddress.port}`);clients.push(restored);
  assert.equal((await request(restored,'room:resume',{code:created.code,token:created.token})).ok,true);
  assert.equal(restored.view.phase,'playing');assert.deepEqual(restored.view.hand.map(c=>c.id).sort(),beforeReconnect);
  assert.equal(restored.view.settings.botDifficulty,'easy');assert.ok(restored.view.turnNumber>=1);
  assert.equal(restored.view.players.find(p=>p.id===created.playerId).image,image);
  const intruder=await connect(`http://127.0.0.1:${nextAddress.port}`);clients.push(intruder);
  assert.equal((await request(intruder,'room:resume',{code:created.code,token:'wrong'})).ok,false);
});

test('a network client must call UNO; a forged declared flag cannot bypass it',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'uno-required-'));
  const server=await createGameServer({dataDir,botDelay:100000,dealDelay:0});const clients=[];
  t.after(async()=>{clients.forEach(c=>c.disconnect());await server.close();await rm(dataDir,{recursive:true,force:true});});
  const address=await server.listen(0,'127.0.0.1'),url=`http://127.0.0.1:${address.port}`;
  const a=await connect(url),b=await connect(url);clients.push(a,b);
  const created=await request(a,'room:create',{name:'A'});await request(b,'room:join',{code:created.code,name:'B'});await request(a,'game:start');
  const r=server.rooms.get(created.code),p=r.players.find(p=>p.id===created.playerId);
  r.deck.push(...p.hand);const index=r.deck.findIndex(c=>/^\d$/.test(c.value));p.hand=[r.deck.splice(index,1)[0],r.deck.pop()];r.color=p.hand[0].color;
  const id=p.hand[0].id,revision=r.revision;
  const blocked=await request(a,'game:play',{cardId:id,uno:true});assert.equal(blocked.ok,false);assert.match(blocked.error,/UNO/);assert.equal(p.hand.length,2);assert.equal(r.revision,revision);
  assert.equal((await request(a,'game:uno')).ok,true);assert.equal((await request(a,'game:play',{cardId:id})).ok,true);assert.equal(p.hand.length,1);assert.equal(p.uno,true);
});
