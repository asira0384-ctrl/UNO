import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,move,view} from '../src/games.js';
import {shogiLegal} from '../src/boards.js';
import {ShogiTable,shogiIndices,shogiTargets,shogiLayout,shogiMovePlan} from '../public/shogi.js';

const players=[{id:'a',name:'A',connected:true},{id:'b',name:'B',connected:true}];
function sparse(){const m=createMatch('shogi',players);m.state.board=Array(81).fill(null);m.state.board[76]={kind:'K',side:0};m.state.board[4]={kind:'K',side:1};return m;}

test('Shogi board geometry fits desktop and iPhone safe viewports in both orientations',()=>{
 for(const [w,h]of [[1340,820],[1870,910],[370,697],[373,693],[743,335],[739,338],[340,540],[680,650]]){
  const p=shogiLayout(w,h);assert.ok(p.size>90);assert.ok(p.size*1.08+(p.wide?88:230)<=h+1,`${w}x${h}`);
  assert.ok(p.size+(p.wide?2*p.panel+48:30)<=w+1,`${w}x${h}`);
 }
});
test('Both players see an exactly reversible 81-square board with their home rank nearest',()=>{
 const first=shogiIndices(0),second=shogiIndices(1);assert.equal(new Set(first).size,81);assert.deepEqual(second,[...first].reverse());assert.deepEqual(first.slice(72),[72,73,74,75,76,77,78,79,80]);assert.deepEqual(second.slice(72),[8,7,6,5,4,3,2,1,0]);
});
test('Move markers distinguish board moves from held pieces and deduplicate promotion choices',()=>{
 const m=sparse();m.state.board[22]={kind:'P',side:0};m.state.hands[0]={P:2,G:1};const legal=shogiLegal(m.state,0);
 assert.deepEqual(shogiTargets(legal,{from:22}),[13]);assert.ok(legal.filter(d=>d.from===22&&d.to===13).length===2);
 const targets=shogiTargets(legal,{drop:'P'});assert.ok(targets.length>0);assert.ok(targets.every(i=>i%9!==4&&i>=9));assert.deepEqual(shogiTargets(legal,null),[]);
});
test('Capturing a promoted piece supplies an animation event and demotes it on the correct tray',()=>{
 const m=sparse();m.state.board[58]={kind:'R',side:0};m.state.board[40]={kind:'p',side:1};const before=view(m,'a');move(m,'a',{from:58,to:40});const after=view(m,'a'),plan=shogiMovePlan(before,after);
 assert.equal(plan.before.kind,'R');assert.equal(plan.after.kind,'R');assert.equal(plan.captured.kind,'p');assert.equal(plan.side,0);assert.equal(after.state.hands[0].P,1);assert.equal(plan.event.check,true);assert.equal(after.state.check,true);assert.equal(after.state.ply,1);assert.equal(shogiMovePlan(after,after),null);
});
test('Promoting and dropping create distinct travel plans for either viewing seat',()=>{
 const m=sparse();m.state.board[22]={kind:'P',side:0};const before=view(m,'b');move(m,'a',{from:22,to:13,promote:true});let plan=shogiMovePlan(before,view(m,'b'));assert.equal(plan.promotion,true);assert.equal(plan.before.kind,'P');assert.equal(plan.after.kind,'p');
 const n=sparse();n.state.hands[0]={G:1};const old=view(n,'a');move(n,'a',{drop:'G',to:40});plan=shogiMovePlan(old,view(n,'a'));assert.equal(plan.move.drop,'G');assert.equal(plan.captured,null);assert.equal(plan.promotion,false);assert.equal(n.state.hands[0].G,0);
});
test('Check markers and legal destinations remain private to the player to move',()=>{
 const m=sparse();m.state.board[58]={kind:'R',side:0};move(m,'a',{from:58,to:40});const own=view(m,'a'),rival=view(m,'b');assert.equal(own.state.legal.length,0);assert.ok(rival.state.legal.length>0);assert.equal(rival.state.check,true);assert.deepEqual(shogiTargets(own.state.legal,{from:40}),[]);
});
test('A timeout closes a pending promotion and releases its drag ghost',()=>{
 const m=createMatch('shogi',players),previous=view(m,'a'),next=structuredClone(previous);next.phase='finished';let closed=0,removed=0;
 const table=Object.assign(Object.create(ShogiTable.prototype),{model:previous,drag:null,promotionCancel:()=>closed++,pendingRelease:{ghost:{remove:()=>removed++}}});
 table.beforeRender(next);assert.equal(closed,1);assert.equal(removed,1);assert.equal(table.pendingRelease,null);assert.equal(table.plan,null);
});
