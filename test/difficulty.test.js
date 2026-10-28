import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPlayer,createRoom,startGame,normalizeSettings,chooseBotPlay,botMove,currentPlayer,playCard,drawCard,publicState,canPlay } from '../src/game.js';

const card=(color,value)=>({id:randomUUID(),color,value});
function room(level='normal',settings={}){
  const p=createPlayer('CPU',0,true),r=createRoom('ABC123',p,{botDifficulty:level,...settings});
  r.players.push(createPlayer('P1',1,true),createPlayer('P2',2,true),createPlayer('P3',3,true));startGame(r);
  r.currentIndex=0;r.color='red';r.discard=[card('red','5')];
  p.hand=[card('red','1'),card('red','skip'),card('wild','wild')];return r;
}
function seeded(seed=123){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('NPC defaults to normal and invalid settings cannot select arbitrary levels',()=>{
  assert.equal(normalizeSettings().botDifficulty,'normal');
  assert.equal(normalizeSettings({botDifficulty:'cheat'}).botDifficulty,'normal');
  for(const level of ['easy','normal','hard'])assert.equal(normalizeSettings({botDifficulty:level}).botDifficulty,level);
});
test('easy can draw voluntarily while normal and hard always use a playable card',()=>{
  assert.equal(chooseBotPlay(room('easy'),undefined,()=>0),null);
  for(const level of ['normal','hard'])assert.ok(chooseBotPlay(room(level),undefined,()=>0)?.card);
});
test('easy never draws a second card when it must play the drawn one',()=>{
  const r=room('easy',{forcePlay:true});r.drawnCardId=r.players[0].hand[0].id;
  assert.equal(chooseBotPlay(r,undefined,()=>0).card.id,r.drawnCardId);
});
test('normal uses several legal choices; hard prioritizes stopping a rival near UNO',()=>{
  const r=room('normal'),random=seeded(),seen=new Set();
  for(let i=0;i<100;i++)seen.add(chooseBotPlay(r,undefined,random).card.value);
  assert.ok(seen.size>=2);r.settings.botDifficulty='hard';r.players[1].hand=[card('blue','1')];
  assert.equal(chooseBotPlay(r).card.value,'skip');
});
test('hard avoids attacking its teammate and targets rivals for seven swaps',()=>{
  const r=room('hard',{mode:'teams',sevenSwap:true});r.currentIndex=1;
  // Seat 1 and seat 3 share a team. Clockwise next seat 2 is an opponent.
  r.players[1].hand=[card('red','7'),card('yellow','2')];
  r.players[0].hand=[card('blue','3'),card('green','9')];r.players[2].hand=[card('blue','1')];r.players[3].hand=[];
  assert.equal(chooseBotPlay(r).targetId,r.players[2].id);
});
test('a same-player reverse advances the turn identity, a playable draw keeps it',()=>{
  const r=room();r.players=r.players.slice(0,2);const p=r.players[0],c=card('red','reverse');p.hand.push(c);
  const n=r.turnNumber;playCard(r,p.id,c.id);assert.equal(r.turnNumber,n+1);assert.equal(currentPlayer(r).id,p.id);
  const before=r.turnNumber;r.deck.push(card('red','9'));drawCard(r,p.id);assert.equal(r.turnNumber,before);
  assert.equal(publicState(r,p.id).turnNumber,before);
});
test('each difficulty completes full matches and conserves every card',()=>{
  const random=seeded(6721);
  for(const level of ['easy','normal','hard'])for(let round=0;round<40;round++){
    const host=createPlayer('CPU',0,true),r=createRoom('ABC123',host,{botDifficulty:level,zeroSeven:round%2===0,stackDraw:true,forcePlay:round%3===0});
    r.players.push(createPlayer('CPU2',1,true),createPlayer('CPU3',2,true),createPlayer('CPU4',3,true));startGame(r);
    for(let move=0;r.phase==='playing'&&move<3000;move++){
      const p=currentPlayer(r),choice=chooseBotPlay(r,p,random);if(choice)assert.ok(canPlay(r,p,choice.card));
      botMove(r,random);
      const all=[...r.deck,...r.discard,...r.players.flatMap(p=>p.hand)];assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108);
    }
    assert.equal(r.phase,'finished',level);
  }
});
