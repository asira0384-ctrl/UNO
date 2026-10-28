import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deck, createPlayer, createRoom, startGame, playCard, drawCard, passTurn, callUno,
  catchUno, canPlay, currentPlayer, publicState, botMove, take } from '../src/game.js';

const card=(color,value)=>({id:randomUUID(),color,value});
function scenario(count=3,settings={}) {
  const p=Array.from({length:count},(_,i)=>createPlayer(`P${i}`,i));
  const r=createRoom('TESTAA',p[0],settings);r.players=p;startGame(r);
  r.currentIndex=0;r.color='red';r.discard=[card('red','5')];
  p.forEach(x=>{x.hand=[card('blue','1'),card('green','3'),card('yellow','9')];});
  return {r,p};
}

test('108 unique cards with the classic distribution',()=>{
  const d=deck();assert.equal(d.length,108);assert.equal(new Set(d.map(c=>c.id)).size,108);
  for(const color of ['red','yellow','green','blue']) {
    assert.equal(d.filter(c=>c.color===color).length,25);
    assert.equal(d.filter(c=>c.color===color&&c.value==='0').length,1);
  }
  assert.equal(d.filter(c=>c.value==='wild4').length,4);
});
test('deal conserves every card and opens with a number',()=>{
  const {r,p}=scenario();startGame({...r,phase:'lobby'});
  const room=createRoom('ABC123',createPlayer('A'));room.players.push(createPlayer('B'));startGame(room);
  assert.equal(room.players[0].hand.length,7);assert.equal(room.players[1].hand.length,7);
  assert.match(room.discard[0].value,/^\d$/);assert.equal(room.deck.length,93);
});
test('reject out-of-turn and illegal plays without mutation',()=>{
  const {r,p}=scenario();const before=JSON.stringify(r);
  assert.throws(()=>playCard(r,p[1].id,p[1].hand[0].id),/番/);
  assert.throws(()=>playCard(r,p[0].id,p[0].hand[0].id),/同じ/);
  assert.equal(JSON.stringify(r),before);
});
test('matching number and matching color are playable',()=>{
  const {r,p}=scenario();assert.equal(canPlay(r,p[0],card('blue','5')),true);
  assert.equal(canPlay(r,p[0],card('red','7')),true);
  assert.equal(canPlay(r,p[0],card('green','7')),false);
});
test('draw two gives two cards and skips the next player',()=>{
  const {r,p}=scenario();const c=card('red','draw2');p[0].hand.push(c);
  playCard(r,p[0].id,c.id);assert.equal(p[1].hand.length,5);assert.equal(currentPlayer(r).id,p[2].id);
});
test('two-player reverse gives the same player another turn',()=>{
  const {r,p}=scenario(2);const c=card('red','reverse');p[0].hand.push(c);
  playCard(r,p[0].id,c.id);assert.equal(currentPlayer(r).id,p[0].id);assert.equal(r.direction,-1);
});
test('reverse changes direction in a four-player match',()=>{
  const {r,p}=scenario(4);const c=card('red','reverse');p[0].hand.push(c);
  playCard(r,p[0].id,c.id);assert.equal(currentPlayer(r).id,p[3].id);
});
test('wild requires a valid selected color; +4 rejects holding current color',()=>{
  const {r,p}=scenario();const c=card('wild','wild4');p[0].hand.push(c,card('red','8'));
  assert.equal(canPlay(r,p[0],c),false);assert.throws(()=>playCard(r,p[0].id,c.id,'blue'),/今の色/);
  p[0].hand=p[0].hand.filter(x=>x.color!=='red');assert.equal(canPlay(r,p[0],c),true);
  assert.throws(()=>playCard(r,p[0].id,c.id,'purple'),/色/);
  playCard(r,p[0].id,c.id,'green');assert.equal(r.color,'green');assert.equal(p[1].hand.length,7);
});
test('drawn playable card can be played, other existing cards cannot',()=>{
  const {r,p}=scenario();const original=card('red','8');p[0].hand.push(original);const drawn=card('red','2');r.deck.push(drawn);
  drawCard(r,p[0].id);assert.equal(r.drawnCardId,drawn.id);assert.equal(currentPlayer(r).id,p[0].id);
  assert.throws(()=>playCard(r,p[0].id,original.id),/引いた/);playCard(r,p[0].id,drawn.id);assert.equal(currentPlayer(r).id,p[1].id);
});
test('unplayable draw passes automatically; playable draw can be passed',()=>{
  const {r,p}=scenario();r.deck.push(card('blue','8'));drawCard(r,p[0].id);assert.equal(currentPlayer(r).id,p[1].id);
  r.currentIndex=0;r.deck.push(card('red','9'));drawCard(r,p[0].id);passTurn(r,p[0].id);assert.equal(currentPlayer(r).id,p[1].id);
});
test('timeout draws once and passes even when the new card matches',()=>{
  const {r,p}=scenario();r.deck.push(card('red','3'));drawCard(r,p[0].id,true);assert.equal(currentPlayer(r).id,p[1].id);assert.equal(r.drawnCardId,null);
});
test('UNO may be declared before discarding the second-last card',()=>{
  const {r,p}=scenario();p[0].hand=[card('red','2'),card('yellow','3')];callUno(r,p[0].id);
  playCard(r,p[0].id,p[0].hand[0].id);assert.equal(p[0].uno,true);assert.equal(r.pendingUno,null);
});
test('UNO is mandatory before the second-last card, including forged declared flags',()=>{
  const {r,p}=scenario();p[0].hand=[card('red','2'),card('yellow','3')];const before=JSON.stringify(r);
  assert.throws(()=>playCard(r,p[0].id,p[0].hand[0].id),/UNO/);assert.equal(JSON.stringify(r),before);
  assert.throws(()=>playCard(r,p[0].id,p[0].hand[0].id,undefined,true),/UNO/);assert.equal(JSON.stringify(r),before);
  callUno(r,p[0].id);playCard(r,p[0].id,p[0].hand[0].id);assert.equal(p[0].uno,true);
});
test('legacy undeclared one-card saves must declare before winning',()=>{
  const {r,p}=scenario();p[0].hand=[card('red','2')];assert.throws(()=>playCard(r,p[0].id,p[0].hand[0].id),/UNO/);
  callUno(r,p[0].id);playCard(r,p[0].id,p[0].hand[0].id);assert.equal(r.phase,'finished');
});
test('draw stacking allows only the same type and the recipient may take the total',()=>{
  const {r,p}=scenario(3,{stackDraw:true});p[0].hand.push(card('red','draw2'));p[1].hand.push(card('blue','draw2'),card('wild','wild4'));
  playCard(r,p[0].id,p[0].hand.at(-1).id);assert.equal(r.drawStack,2);assert.equal(p[1].hand.length,5);
  assert.equal(canPlay(r,p[1],p[1].hand.at(-1)),false);playCard(r,p[1].id,p[1].hand.at(-2).id);
  assert.equal(r.drawStack,4);const count=p[2].hand.length;drawCard(r,p[2].id);assert.equal(p[2].hand.length,count+4);assert.equal(r.drawStack,0);assert.equal(currentPlayer(r).id,p[0].id);
});
test('last action card applies its penalty before scoring',()=>{
  const {r,p}=scenario(2,{stackDraw:true});p[0].hand=[card('red','draw2')];callUno(r,p[0].id);const count=p[1].hand.length;
  playCard(r,p[0].id,p[0].hand[0].id);assert.equal(r.phase,'finished');assert.equal(p[1].hand.length,count+2);assert.equal(r.winnerId,p[0].id);assert.ok(p[0].score>0);
});
test('discard pile is recycled without losing the current top',()=>{
  const {r}=scenario();r.deck=[];const a=card('red','1'),b=card('blue','3'),top=card('green','4');r.discard=[a,b,top];
  const drawn=take(r,2);assert.equal(drawn.length,2);assert.deepEqual(r.discard,[top]);assert.equal(new Set([...drawn,...r.discard].map(c=>c.id)).size,3);
});
test('snapshots hide every other hand and all reconnect secrets',()=>{
  const {r,p}=scenario();const view=publicState(r,p[0].id);assert.deepEqual(view.hand,p[0].hand);
  for(const x of view.players){assert.equal(x.hand,undefined);assert.equal(x.token,undefined);}
  assert.equal(JSON.stringify(view).includes(p[1].hand[0].id),false);assert.equal(JSON.stringify(view).includes(p[0].token),false);assert.equal(view.deck,undefined);
});
test('100 full CPU matches finish, preserving all 108 cards',()=>{
  let turns=0;
  for(let round=0;round<100;round++) {
    const a=createPlayer('A',0,true),room=createRoom('SIM',a,{stackDraw:round%2===0});
    room.players.push(createPlayer('B',1,true),createPlayer('C',2,true),createPlayer('D',3,true));startGame(room);
    let count=0;
    while(room.phase==='playing'&&count++<20000) {
      botMove(room);
      const all=[...room.deck,...room.discard,...room.players.flatMap(p=>p.hand)];
      assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108);
    }
    assert.equal(room.phase,'finished');assert.equal(room.players.find(p=>p.id===room.winnerId).hand.length,0);turns+=count;
  }
  assert.ok(turns>100);
});
