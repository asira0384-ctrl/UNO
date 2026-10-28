import test from 'node:test';
import assert from 'node:assert/strict';
import { turnStatus, TurnFeedback, eventVoices } from '../public/feedback.js';

const now=1_000_000;
const state=()=>({code:'ABC123',round:1,turnNumber:1,phase:'playing',selfId:'a',currentId:'a',
  players:[{id:'a',name:'私'},{id:'b',name:'CPU'}],settings:{turnSeconds:30},paused:false,
  dealUntil:0,turnEndsAt:now+30000,roundEndsAt:now+180000});

test('turn changes and a two-player reverse never make a sound',()=>{
  const s=state(),f=new TurnFeedback();assert.deepEqual(f.update(s,now).cues,[]);
  s.turnNumber++;s.turnEndsAt+=1000;assert.deepEqual(f.update(s,now+1000).cues,[]);
});
test('own countdown is silent until three and ticks once per second',()=>{
  const s=state(),f=new TurnFeedback();f.update(s,now);
  for(const seconds of [20,10,5,4])assert.equal(f.update(s,now+(30-seconds)*1000).cues.length,0);
  for(const seconds of [3,2,1]){assert.deepEqual(f.update(s,now+(30-seconds)*1000).cues,[{effect:'tick'}]);assert.equal(f.update(s,now+(30-seconds)*1000+100).cues.length,0);}
});
test('drawing a playable card resets the final-second tick allowance',()=>{
  const s=state(),f=new TurnFeedback();f.update(s,now);assert.equal(f.update(s,now+27000).cues.length,1);
  s.turnEndsAt=now+57000;assert.equal(f.update(s,now+27000).cues.length,0);assert.equal(f.update(s,now+54000).cues.length,1);
});
test('opponent turns have no personal warning and match ticks only use the last three seconds',()=>{
  const s=state(),f=new TurnFeedback();s.currentId='b';s.roundEndsAt=now+30000;f.update(s,now);
  assert.equal(f.update(s,now+20000).cues.length,0);assert.deepEqual(f.update(s,now+27000).cues,[{effect:'tick-match'}]);
});
test('simultaneous personal and match countdowns produce one tick',()=>{
  const s=state(),f=new TurnFeedback();s.roundEndsAt=s.turnEndsAt;f.update(s,now);assert.equal(f.update(s,now+27000).cues.length,1);
});
test('dealing, offline, paused, finished and hidden play is silent',()=>{
  for(const change of [{dealUntil:now+3000},{paused:true},{phase:'finished'}])assert.equal(new TurnFeedback().update({...state(),...change},now).cues.length,0);
  assert.equal(new TurnFeedback().update(state(),now,{connected:false}).cues.length,0);assert.equal(new TurnFeedback().update(state(),now,{visible:false}).cues.length,0);
});
test('turn status is readable and its progress is bounded',()=>{
  const s=state();assert.equal(turnStatus(s,now).title,'あなたの番！');
  assert.equal(turnStatus(s,now+25000).urgent,true);assert.equal(turnStatus(s,now+90000).progress,0);
});
test('wilds narrate the selected color even on a winning play and CPU UNO is announced',()=>{
  assert.deepEqual(eventVoices([
    {type:'play',card:{color:'wild',value:'wild4'},color:'blue',uno:true,announceUno:true},
    {type:'win'},
  ]),['blue','uno']);
  for(const color of ['red','blue','yellow','green'])assert.deepEqual(eventVoices([{type:'play',card:{color:'wild',value:'wild'},color}]),[color]);
});
test('an armed UNO call is not repeated on the following discard',()=>{
  assert.deepEqual(eventVoices([{type:'uno'},{type:'play',card:{color:'red',value:'reverse'},uno:true,announceUno:false}]),['uno','reverse']);
  assert.deepEqual(eventVoices([{type:'draw',timedOut:true}]),[]);
});
test('skip and reverse each emit one action call, including a winning skip',()=>{
  for(const value of ['skip','reverse'])assert.deepEqual(eventVoices([{type:'play',card:{color:'red',value},uno:false},{type:'win'}]),[value]);
});
