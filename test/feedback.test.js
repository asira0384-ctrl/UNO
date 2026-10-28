import test from 'node:test';
import assert from 'node:assert/strict';
import { turnStatus, TurnFeedback, eventVoices } from '../public/feedback.js';

const now=1_000_000;
const state=()=>({code:'ABC123',round:1,turnNumber:1,phase:'playing',selfId:'a',currentId:'a',
  players:[{id:'a',name:'私'},{id:'b',name:'CPU'}],settings:{turnSeconds:30},paused:false,
  dealUntil:0,turnEndsAt:now+30000,roundEndsAt:now+180000});

test('your turn is announced once, including another turn after a two-player reverse',()=>{
  const f=new TurnFeedback(),s=state();
  assert.equal(f.update(s,now).cues.filter(c=>c.intro).length,1);
  assert.equal(f.update(s,now+200).cues.length,0);
  s.turnNumber++;s.turnEndsAt=now+32000;
  assert.equal(f.update(s,now+2000).cues.filter(c=>c.intro).length,1);
});
test('drawing a playable card resets the countdown without repeating your turn',()=>{
  const f=new TurnFeedback(),s=state();f.update(s,now);
  assert.equal(f.update(s,now+25000).cues.find(c=>c.voice==='hurry')?.effect,'tick');
  s.turnEndsAt=now+55000;
  assert.equal(f.update(s,now+25000).cues.length,0);
  assert.equal(f.update(s,now+50000).cues.find(c=>c.voice==='hurry')?.effect,'tick');
});
test('own countdown emits one warning at ten and one tick per final second',()=>{
  const f=new TurnFeedback(),s=state();f.update(s,now);
  assert.deepEqual(f.update(s,now+20000).cues,[{effect:'warning'}]);
  assert.equal(f.update(s,now+20200).cues.length,0);
  for(let n=5;n>=1;n--){
    assert.equal(f.update(s,now+(30-n)*1000).cues.filter(c=>c.effect.startsWith('tick')).length,1);
    assert.equal(f.update(s,now+(30-n)*1000+100).cues.length,0);
  }
  assert.equal(f.update(s,now+30000).cues.length,0);
});
test('opponent turns do not produce the personal hurry or turn announcements',()=>{
  const s=state();s.currentId='b';const f=new TurnFeedback();
  assert.match(f.update(s,now).title,/CPU/);assert.equal(f.update(s,now+25000).cues.length,0);
});
test('match warnings are emitted once at thirty and ten seconds with final ticks',()=>{
  const s=state();s.currentId='b';s.roundEndsAt=now+31000;const f=new TurnFeedback();f.update(s,now);
  assert.equal(f.update(s,now+1000).cues[0].voice,'thirty-seconds');
  assert.equal(f.update(s,now+1200).cues.length,0);
  assert.equal(f.update(s,now+21000).cues[0].voice,'ten-seconds');
  assert.equal(f.update(s,now+26000).cues[0].effect,'tick-match');
});
test('simultaneous match and personal final seconds produce only one tick',()=>{
  const s=state();s.roundEndsAt=s.turnEndsAt;const f=new TurnFeedback();f.update(s,now);
  assert.equal(f.update(s,now+25000).cues.filter(c=>c.effect.startsWith('tick')).length,1);
});
test('dealing, paused, offline, finished and hidden games suppress audio',()=>{
  for(const change of [{dealUntil:now+3000},{paused:true},{phase:'finished'}]){
    const s={...state(),...change};assert.equal(new TurnFeedback().update(s,now).cues.length,0);
  }
  assert.equal(new TurnFeedback().update(state(),now,{connected:false}).cues.length,0);
  assert.equal(new TurnFeedback().update(state(),now,{visible:false}).cues.length,0);
  const s=state(),f=new TurnFeedback();s.dealUntil=now+3000;f.update(s,now);
  assert.equal(f.update(s,now+3001).cues[0].voice,'your-turn');
});
test('returning from the background does not replay old match milestones',()=>{
  const s=state(),f=new TurnFeedback();s.roundEndsAt=now+31000;f.update(s,now);
  f.update(s,now+1000,{visible:false});
  assert.equal(f.update(s,now+27000).cues.filter(c=>c.voice==='thirty-seconds'||c.voice==='ten-seconds').length,0);
});
test('turn status is readable and its progress is bounded',()=>{
  const s=state();assert.equal(turnStatus(s,now).title,'あなたの番！');
  assert.equal(turnStatus(s,now+25000).urgent,true);assert.equal(turnStatus(s,now+90000).progress,0);
});
test('wilds narrate the selected color even on a winning play and CPU UNO is announced',()=>{
  assert.deepEqual(eventVoices([
    {type:'play',card:{color:'wild',value:'wild4'},color:'blue',uno:true,announceUno:true},
    {type:'win'},
  ]),['draw-four','blue','uno']);
  for(const color of ['red','blue','yellow','green'])assert.deepEqual(eventVoices([{type:'play',card:{color:'wild',value:'wild'},color}]),[color]);
});
test('an armed UNO call is not repeated on the following discard',()=>{
  assert.deepEqual(eventVoices([{type:'uno'},{type:'play',card:{color:'red',value:'reverse'},uno:true,announceUno:false}]),['uno','reverse']);
  assert.deepEqual(eventVoices([{type:'draw',timedOut:true}]),['time-up']);
});
