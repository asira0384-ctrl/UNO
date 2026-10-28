import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRoom,createPlayer,startGame,playCard,drawCard,passTurn,botMove,finishOnTime,publicState,canPlay,callUno } from '../src/game.js';

const c=(color,value)=>({id:randomUUID(),color,value});
function room(settings={},count=4){
  const r=createRoom('RULES1',createPlayer('A'),settings);
  while(r.players.length<count)r.players.push(createPlayer(`P${r.players.length}`,r.players.length));
  startGame(r);r.currentIndex=0;r.color='red';r.discard=[c('red','5')];
  r.players.forEach(p=>{p.hand=[c('blue','1'),c('yellow','2')];});return r;
}
test('seven requires a valid target, then swaps complete hands without changing player identities',()=>{
  const r=room({sevenSwap:true}),[a,b]=r.players;a.hand=[c('red','7'),c('blue','4')];b.hand=[c('yellow','3'),c('yellow','8'),c('green','2')];
  callUno(r,a.id);const seven=a.hand[0],before=JSON.stringify(r),bCards=b.hand.map(c=>c.id);
  assert.throws(()=>playCard(r,a.id,seven.id),/交換/);assert.equal(JSON.stringify(r),before);
  playCard(r,a.id,seven.id,undefined,false,b.id);assert.deepEqual(a.hand.map(c=>c.id),bCards);assert.equal(b.hand.length,1);assert.equal(b.uno,true);assert.equal(r.events.at(-1).exchange.targetId,b.id);
});
test('last seven finishes immediately without requiring an exchange target',()=>{
  const r=room({zeroSeven:true}),a=r.players[0];a.hand=[c('red','7')];callUno(r,a.id);playCard(r,a.id,a.hand[0].id);assert.equal(r.phase,'finished');assert.equal(r.winnerId,a.id);
});
test('zero rotates each hand once in the current direction',()=>{
  for(const dir of [1,-1]){
    const r=room({zeroSeven:true});r.direction=dir;const a=r.players[0];a.hand.push(c('red','0'));const zero=a.hand.at(-1);
    const expected=r.players.map(p=>p.hand.filter(c=>c!==zero).map(c=>c.id));playCard(r,a.id,zero.id);
    r.players.forEach((p,i)=>assert.deepEqual(p.hand.map(c=>c.id),expected[(i-dir+4)%4]));
  }
});
test('forced play prevents pass and a timeout plays the drawn card',()=>{
  const r=room({forcePlay:true}),a=r.players[0],drawn=c('red','6');r.deck.push(drawn);drawCard(r,a.id);
  assert.equal(r.drawnCardId,drawn.id);assert.throws(()=>passTurn(r,a.id),/強制/);
  drawCard(r,a.id,true);assert.equal(r.discard.at(-1).id,drawn.id);assert.equal(r.players[r.currentIndex].id,r.players[1].id);
});
test('forced play also applies to a newly drawn timeout card',()=>{
  const r=room({forcePlay:true}),a=r.players[0],drawn=c('red','6');r.deck.push(drawn);drawCard(r,a.id,true);
  assert.equal(r.discard.at(-1).id,drawn.id);assert.equal(r.currentIndex,1);
});
test('team victory awards both partners and only counts opponents hands',()=>{
  const r=room({mode:'teams'}),a=r.players[0];a.hand=[c('red','2')];
  r.players[1].hand=[c('blue','3')];r.players[2].hand=[c('blue','9')];r.players[3].hand=[c('green','4')];
  callUno(r,a.id);playCard(r,a.id,a.hand[0].id);assert.equal(r.winnerTeam,0);assert.equal(r.players[0].score,7);assert.equal(r.players[2].score,7);assert.equal(r.players[1].score,0);
  assert.deepEqual(r.rankings.filter(p=>p.won).map(p=>p.id).sort(),[a.id,r.players[2].id].sort());
});
test('2vs2 requires four players and fixes the room capacity at four',()=>{
  const a=createPlayer('A'),r=createRoom('TEAMS1',a,{mode:'teams',maxPlayers:2});r.players.push(createPlayer('B'));
  assert.equal(r.settings.maxPlayers,4);assert.throws(()=>startGame(r),/4人/);
});
test('time limit chooses the smallest remaining hand value and supports exact draws',()=>{
  const r=room();r.players.forEach((p,i)=>{p.hand=[c('blue',String(i+1))];});finishOnTime(r);assert.equal(r.winnerId,r.players[0].id);assert.equal(r.phase,'finished');
  const tied=room();tied.players.forEach(p=>{p.hand=[c('blue','1')];});finishOnTime(tied);assert.equal(tied.draw,true);assert.equal(tied.winnerId,null);assert.equal(tied.players[0].score,0);
});
test('team time limit compares combined hand points',()=>{
  const r=room({mode:'teams'});[1,7,2,6].forEach((v,i)=>{r.players[i].hand=[c('blue',String(v))];});finishOnTime(r);assert.equal(r.winnerTeam,0);
});
test('deal countdown blocks actions until the authoritative start',()=>{
  const r=room();r.phase='lobby';startGame(r,10000);const a=r.players[r.currentIndex];
  assert.equal(canPlay(r,a,a.hand[0]),false);assert.throws(()=>drawCard(r,a.id),/配って/);assert.equal(publicState(r,a.id).playableIds.length,0);
});
test('100 complete matches with exchanges, teams, stacking and forced play preserve all cards',()=>{
  for(let i=0;i<100;i++){
    const r=createRoom('EXTRA1',createPlayer('A',0,true),{mode:i%3===0?'teams':'solo',zeroSeven:i%2===0,sevenSwap:i%2===1,stackDraw:i%4<2,forcePlay:i%4===0,roundMinutes:0});
    while(r.players.length<4)r.players.push(createPlayer('CPU',1,true));startGame(r);let turns=0;
    while(r.phase==='playing'&&turns++<20000){botMove(r);const cards=[...r.deck,...r.discard,...r.players.flatMap(p=>p.hand)];assert.equal(cards.length,108);assert.equal(new Set(cards.map(c=>c.id)).size,108);}
    assert.equal(r.phase,'finished');assert.ok(r.rankings.some(p=>p.won));
  }
});
