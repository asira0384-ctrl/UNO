import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,createPlayer,createRoom,startGame,take} from '../src/game.js';

test('draws consume the next card exactly once without searching for or against a color',()=>{
  const cards=[{id:'r',color:'red'},{id:'y',color:'yellow'},{id:'g',color:'green'},{id:'b',color:'blue'}];
  const r={deck:[...cards],discard:[]};assert.deepEqual(take(r,4).map(c=>c.id),['b','g','y','r']);assert.equal(r.deck.length,0);
});
test('all colors occur at their expected frequency in the shuffled draw position',()=>{
  const count={red:0,yellow:0,green:0,blue:0,wild:0},n=6000;
  for(let i=0;i<n;i++)count[deck().at(-1).color]++;
  for(const color of ['red','yellow','green','blue'])assert.ok(Math.abs(count[color]/n-25/108)<.045,`${color}: ${count[color]}`);
  assert.ok(Math.abs(count.wild/n-8/108)<.03);
});
test('round-robin dealing uses one shared deck and has no human or CPU color advantage',()=>{
  const counts=Array.from({length:4},()=>({red:0,yellow:0,green:0,blue:0}));
  for(let game=0;game<500;game++){
    const p=Array.from({length:4},(_,i)=>createPlayer(`P${i}`,i,i%2===1)),r=createRoom('FAIRAA',p[0]);r.players=p;startGame(r);
    const all=[...r.deck,...r.discard,...p.flatMap(p=>p.hand)];assert.equal(new Set(all.map(c=>c.id)).size,108);
    for(let seat=0;seat<4;seat++)for(const card of p[seat].hand)if(card.color!=='wild')counts[seat][card.color]++;
  }
  for(const seat of counts)for(const color of Object.keys(seat))assert.ok(Math.abs(seat[color]/3500-25/108)<.055);
});
