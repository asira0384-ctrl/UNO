import test from 'node:test';
import assert from 'node:assert/strict';
import { PartyAudio } from '../public/audio.js';

function setup(t,{state='suspended',pending=false,saved={},loadVoices=false,speech=false}={}){
  const keys=['window','navigator','Audio','localStorage','document','fetch'];const old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(){},disconnect(){},start(){},stop(){},gain:param(),frequency:param(),threshold:param(),ratio:param()});
  class Context{
    constructor(){this.state=state;this.sampleRate=8000;this.currentTime=0;this.destination={};this.resumeCalls=0;if(loadVoices)this.decodeAudioData=()=>Promise.resolve({duration:15});}
    createGain(){return node();}createDynamicsCompressor(){return node();}createOscillator(){return node();}createBiquadFilter(){return node();}createBufferSource(){return node();}
    createBuffer(channels,length){return{getChannelData:()=>new Float32Array(length)};}
    resume(){this.resumeCalls++;if(pending)return new Promise(()=>{});this.state='running';this.onstatechange?.();return Promise.resolve();}
    suspend(){this.state='suspended';this.onstatechange?.();return Promise.resolve();}
  }
  class Media extends EventTarget{
    constructor(src){super();this.src=src;this.paused=true;this.playCalls=0;this.volume=1;this.rejectNext=false;this.readyState=1;}
    setAttribute(){}
    play(){this.playCalls++;if(this.rejectNext){this.rejectNext=false;return Promise.reject(new Error('gesture required'));}this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
    pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  }
  const storage={value:JSON.stringify(saved),getItem(){return this.value;},setItem(k,v){this.value=v;}};
  const synth={calls:[],getVoices:()=>[{name:'日本語',lang:'ja-JP',localService:true},{name:'English',lang:'en-US',localService:true}],speak(u){this.calls.push(u);},resume(){},cancel(){this.cancelled=true;},addEventListener(){}};
  class Utterance{constructor(text){this.text=text;}}
  Object.defineProperties(globalThis,{window:{value:{AudioContext:Context,...(speech?{speechSynthesis:synth,SpeechSynthesisUtterance:Utterance}:{})},configurable:true},navigator:{value:{audioSession:{type:'auto'}},configurable:true},Audio:{value:Media,configurable:true},localStorage:{value:storage,configurable:true},document:{value:{hidden:false},configurable:true}});
  if(loadVoices)Object.defineProperty(globalThis,'fetch',{value:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}),configurable:true});
  t.after(()=>{for(const [key,value]of old)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
  const audio=new PartyAudio();t.after(()=>audio.cancelVoices());return audio;
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
test('audio stays idle until a player gesture',t=>{const a=setup(t);assert.equal(a.unlock(),false);assert.equal(a.bgm,null);assert.equal(a.ctx,null);});
test('an interrupted iOS context is resumed, including after a second interruption',async t=>{
  const a=setup(t,{state:'interrupted'});a.unlock({gesture:true});assert.equal(a.ctx.state,'running');assert.equal(a.ctx.resumeCalls,1);assert.equal(navigator.audioSession.type,'playback');
  a.ctx.state='interrupted';a.unlock({gesture:true});assert.equal(a.ctx.resumeCalls,2);assert.equal(a.ctx.state,'running');await settle();assert.equal(a.status().musicPlaying,true);
});
test('native BGM starts even when Web Audio resume never settles',async t=>{
  const a=setup(t,{pending:true});a.unlock({gesture:true});assert.equal(a.bgm.playCalls,1);assert.equal(a.bgm.paused,false);assert.equal(a.ctx.state,'suspended');await settle();assert.equal(a.status().musicPlaying,true);
});
test('backgrounding stops music and returning restores it without losing volume',async t=>{
  const a=setup(t);a.unlock({gesture:true});a.set('musicVolume',53);await settle();
  a.visibility(false);await settle();assert.equal(a.bgm.paused,true);assert.equal(a.ctx.state,'suspended');
  a.visibility(true);await settle();assert.equal(a.bgm.paused,false);assert.equal(a.ctx.state,'running');assert.equal(a.settings.musicVolume,53);assert.equal(a.bgm.volume,.53*.65);
});
test('closed contexts are recreated on a later tap',t=>{const a=setup(t);a.unlock({gesture:true});const old=a.ctx;old.state='closed';a.unlock({gesture:true});assert.notEqual(a.ctx,old);assert.equal(a.ctx.state,'running');});
test('muted music stays muted across focus changes',async t=>{const a=setup(t);a.unlock({gesture:true});a.set('music',false);a.visibility(false);await settle();a.visibility(true);await settle();assert.equal(a.bgm.paused,true);assert.equal(a.settings.music,false);});
test('a rejected native play can be retried by a tap',async t=>{
  const a=setup(t);a.unlock({gesture:true});await settle();a.bgm.pause();a.bgm.rejectNext=true;a.unlock({gesture:true});await settle();assert.match(a.status().error,/タップ/);assert.equal(a.bgm.paused,true);
  a.unlock({gesture:true});await settle();assert.equal(a.status().musicPlaying,true);assert.equal(a.bgmError,'');
});
test('native sound test runs even with both sound preferences off',async t=>{const a=setup(t,{saved:{music:false,effects:false}});assert.equal(await a.test(),true);assert.equal(a.testAudio.playCalls,1);assert.equal(a.bgm,null);});
test('persisted volume values cannot break the audio graph',t=>{const a=setup(t,{saved:{musicVolume:900,effectsVolume:-10}});assert.equal(a.settings.musicVolume,100);assert.equal(a.settings.effectsVolume,0);a.unlock({gesture:true});assert.doesNotThrow(()=>a.effect('click'));});

test('game calls play the purpose-built Japanese clip and stay queued in order',async t=>{
  const a=setup(t,{loadVoices:true});a.unlock({gesture:true});await a.voiceLoading;
  assert.ok(a.voiceBuffer);a.announce('red');assert.equal(a.voiceBusy.name,'red');
  a.announce('reverse');a.announce('uno');a.voiceBusy.source.onended();assert.equal(a.voiceBusy.name,'reverse');
  a.voiceBusy.source.onended();assert.equal(a.voiceBusy.name,'uno');a.cancelVoices();
});
test('turn and extra narrations remain silent',t=>{
  const a=setup(t);a.unlock({gesture:true});let notes=0;a.tone=()=>notes++;a.hiss=()=>notes++;
  for(const name of ['click','turn','start','error','uno'])a.effect(name);assert.equal(notes,0);
  for(const name of ['your-turn','hurry','ten-seconds','draw-four','skip','time-up'])assert.equal(a.announce(name),false);
});
test('voice has an independent volume and switch',async t=>{
  const a=setup(t,{loadVoices:true,saved:{music:false,effects:false,voiceVolume:72}});a.unlock({gesture:true});await a.voiceLoading;
  assert.equal(a.announce('blue'),true);assert.equal(a.settings.voiceVolume,72);assert.equal(a.bgm,null);
  a.set('voices',false);assert.equal(a.voiceBusy,null);assert.equal(a.announce('uno'),false);
});
test('a native primed channel handles an interrupted Web Audio context',async t=>{
  const a=setup(t,{pending:true});a.unlock({gesture:true});await settle();assert.equal(a.ctx.state,'suspended');
  a.announce('green');await settle();assert.equal(a.voiceBusy.native,true);a.cancelVoices();
});
test('hiding the page cancels current and queued calls',async t=>{
  const a=setup(t,{loadVoices:true});a.unlock({gesture:true});await a.voiceLoading;a.announce('yellow');a.announce('uno');a.visibility(false);
  assert.equal(a.voiceBusy,null);assert.equal(a.voiceQueue.length,0);assert.equal(a.announce('red'),false);
});
test('BGM loses at most eight percent while a voice plays',async t=>{
  const a=setup(t,{loadVoices:true});a.unlock({gesture:true});await a.voiceLoading;const normal=a.bgm.volume;
  a.announce('reverse');assert.ok(a.bgm.volume/normal>=.91999);a.cancelVoices();assert.equal(a.bgm.volume,normal);
});
test('theme changes switch music without overriding mute or volume preferences',async t=>{
  const a=setup(t);a.unlock({gesture:true});a.set('musicVolume',47);a.setTheme(1);await settle();assert.match(a.bgm.src,/scene-2/);assert.equal(a.settings.musicVolume,47);
  a.set('music',false);a.setTheme(2);await settle();assert.equal(a.bgm.paused,true);assert.equal(a.settings.music,false);
});
test('last-second ticks have a separate switch and the win can use a deep impact',t=>{
  const a=setup(t);a.unlock({gesture:true});let notes=0;a.tone=()=>notes++;a.hiss=()=>notes++;
  a.set('alerts',false);a.effect('tick');assert.equal(notes,0);a.effect('deal');assert.equal(notes,2);
  notes=0;a.effect('slam');assert.ok(notes>=3);notes=0;a.set('alerts',true);a.effect('tick');assert.equal(notes,1);
});
