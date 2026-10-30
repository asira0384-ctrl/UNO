import { THEMES } from './themes.js?v=2.3';
import { VOICE_FILE,VOICE_CLIPS } from './voice-clips.js?v=2.3';
import { VariationBag } from './variations.js?v=2.3';
export const SHOGI_MUSIC=['木漏れ日の庭','月影の笛','竹の風','花灯り','水面の調べ'].map((name,i)=>({name,file:'/assets/audio/hub-shogi-'+(i+1)+'.mp3'}));
// Quiet paper effects, native MP3 music and short Japanese game calls.
export const JAPANESE_CALLS={red:'レッド！',yellow:'イエロー！',green:'グリーン！',blue:'ブルー！',reverse:'リバース！',skip:'スキップ！',uno:'ウノ！',check:'王手！'};
export class PartyAudio {
  constructor(){
    let saved={};try{saved=JSON.parse(localStorage.getItem('uno-audio')||'{}');}catch{}
    const volume=(v,f)=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):f;
    this.settings={music:saved.music!==false,effects:saved.effects!==false,voices:saved.voices!==false,alerts:saved.alerts!==false,
      musicVolume:volume(saved.musicVolume,24),effectsVolume:volume(saved.effectsVolume,50),voiceVolume:volume(saved.voiceVolume,85)};
    this.ctx=null;this.bgm=null;this.testAudio=null;this.visible=typeof document==='undefined'||!document.hidden;
    this.hasGesture=false;this.bgmError='';this.contextError='';this.voiceError='';this.listeners=new Set();
    this.voiceChoices=new VariationBag();this.effectChoices=new VariationBag();
    this.voiceQueue=[];this.voiceBusy=null;this.voiceBuffer=null;this.voiceLoading=null;this.voiceMedia=null;this.theme=0;

  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn(this.status());}
  status(){return {activated:this.hasGesture,musicPlaying:!!this.bgm&&!this.bgm.paused&&!this.bgmError,
    context:this.ctx?.state||'not-started',error:this.bgmError||this.contextError,voiceError:this.voiceError,
    voiceReady:!!this.voiceBuffer||!!this.voiceMedia&&this.voiceMedia.readyState>=1,
    needsTap:!this.hasGesture||(this.settings.music&&this.settings.musicVolume>0&&(!this.bgm||this.bgm.paused))||
      (this.settings.effects&&this.ctx?.state!=='running')};}
  configureSession(){try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback';}catch{}}
  unlock({gesture=false}={}){
    if(gesture)this.hasGesture=true;if(!this.hasGesture||!this.visible)return false;this.configureSession();
    if(this.settings.music&&this.settings.musicVolume>0)this.startMusic();
    if(gesture&&this.settings.voices)this.primeVoice();
    try{
      if(!this.ctx||this.ctx.state==='closed'){
        this.ctx=new(window.AudioContext||window.webkitAudioContext)();
        this.ctx.onstatechange=()=>{if(this.ctx.state==='running'){this.contextError='';this.apply();}this.notify();};
        const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=5;compressor.connect(this.ctx.destination);
        this.musicGain=this.ctx.createGain();this.musicGain.connect(compressor);this.effectsGain=this.ctx.createGain();this.effectsGain.connect(compressor);this.voiceGain=this.ctx.createGain();this.voiceGain.connect(compressor);
        this.noise=this.ctx.createBuffer(1,Math.round(this.ctx.sampleRate*.2),this.ctx.sampleRate);
        const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      }
      const source=this.ctx.createBufferSource();source.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);source.connect(this.ctx.destination);source.start(0);source.onended=()=>source.disconnect();
      if(this.ctx.state!=='running')Promise.resolve(this.ctx.resume()).then(()=>{this.apply();this.notify();},()=>{this.contextError='画面をタップすると効果音を再開できます';this.notify();});
      this.apply();this.prepareVoices();
    }catch{this.contextError='効果音を開始できません';}
    this.notify();return true;
  }
  set(key,value){
    if(!['music','effects','voices','alerts','musicVolume','effectsVolume','voiceVolume'].includes(key))return;
    this.settings[key]=key.endsWith('Volume')?Math.max(0,Math.min(100,Number(value)||0)):value===true;
    try{localStorage.setItem('uno-audio',JSON.stringify(this.settings));}catch{}
    if(!this.settings.voices||!this.settings.voiceVolume)this.cancelVoices();this.apply();
    if(this.settings.music&&this.settings.musicVolume>0&&this.visible)this.unlock();else this.stopMusic();this.notify();
  }
  apply(){
    if(this.bgm)this.bgm.volume=this.settings.musicVolume/100*.65*(this.voiceBusy ? .92 : 1);
    if(this.ctx){this.musicGain?.gain.setTargetAtTime(0,this.ctx.currentTime,.03);this.effectsGain?.gain.setTargetAtTime(this.settings.effects?this.settings.effectsVolume/100*.52:0,this.ctx.currentTime,.02);this.voiceGain?.gain.setTargetAtTime(this.settings.voices?this.settings.voiceVolume/100:0,this.ctx.currentTime,.02);}
  }
  startMusic(){
    if(!this.hasGesture||!this.visible||!this.settings.music||this.settings.musicVolume===0)return;
    try{
      if(!this.bgm){this.bgm=new Audio((this.gameMusic||THEMES[this.theme].music)+'?v=2.3');this.bgm.loop=true;this.bgm.preload='auto';this.bgm.setAttribute('playsinline','');
        this.bgm.addEventListener('playing',()=>{this.bgmError='';this.notify();});this.bgm.addEventListener('pause',()=>this.notify());
        this.bgm.addEventListener('error',()=>{this.bgmError='音楽を読み込めません。ページを再読み込みしてね';this.notify();});}
      this.apply();if(this.bgm.paused)Promise.resolve(this.bgm.play()).then(()=>{if(!this.visible||!this.settings.music||!this.settings.musicVolume)this.bgm.pause();this.bgmError='';this.notify();},()=>{this.bgmError='「音を開始」をタップしてね';this.notify();});
    }catch{this.bgmError='音楽を開始できません';this.notify();}
  }
  setTheme(index){
    const next=Number.isInteger(index)&&index>=0&&index<THEMES.length?index:0;if(next===this.theme)return;
    this.theme=next;if(this.currentGame==='shogi'){this.changeMusic(SHOGI_MUSIC[next].file);return;}if(this.gameMusic)return;if(this.bgm){this.bgm.pause();this.bgm.src=THEMES[next].music+'?v=2.3';this.bgm.currentTime=0;this.bgm.load?.();this.bgmError='';if(this.settings.music&&this.visible)this.startMusic();}
  }
  changeMusic(track){
    if(track===this.gameMusic)return;this.gameMusic=track;
    if(this.bgm){this.bgm.pause();this.bgm.src=(track||THEMES[this.theme].music)+'?v=2.3';this.bgm.currentTime=0;this.bgm.load?.();this.bgmError='';this.startMusic();}
  }
  setGame(game){
    this.currentGame=game;
    this.changeMusic(game==='shogi'?SHOGI_MUSIC[this.theme].file:['reversi','oldmaid','president','poker','speed','memory','blackjack'].includes(game)?'/assets/audio/hub-'+game+'.mp3':null);
  }
  stopMusic(){this.bgm?.pause();}
  async test(){this.unlock({gesture:true});try{this.testAudio ||=new Audio('/assets/audio/sound-test.mp3?v=2.3');this.testAudio.setAttribute('playsinline','');this.testAudio.volume=.6;this.testAudio.currentTime=0;await this.testAudio.play();return true;}catch{return false;}}
  primeVoice(){
    if(this.voiceBusy||this.voiceMedia&&!this.voiceError)return;
    try{
      if(!this.voiceMedia){this.voiceMedia=new Audio(VOICE_FILE);this.voiceMedia.preload='auto';this.voiceMedia.setAttribute('playsinline','');this.voiceMedia.addEventListener('loadedmetadata',()=>this.pumpVoice());}
      this.voiceMedia.currentTime=0;
      Promise.resolve(this.voiceMedia.play()).then(()=>{if(!this.voiceBusy)this.voiceMedia.pause();this.voiceError='';this.notify();},()=>{this.voiceError='画面をタップするとボイスを再開できます';this.notify();});
    }catch{this.voiceError='ボイスを開始できません';}
  }
  prepareVoices(){
    if(this.voiceBuffer||this.voiceLoading||!this.ctx?.decodeAudioData||typeof fetch!=='function')return;
    this.voiceLoading=fetch(VOICE_FILE).then(r=>{if(!r.ok)throw Error('voice');return r.arrayBuffer();})
      .then(data=>this.ctx.decodeAudioData(data)).then(buffer=>{this.voiceBuffer=buffer;this.voiceError='';this.notify();})
      .catch(()=>{this.voiceError='ボイス音源を読み込めません。再読み込みしてね';this.notify();})
      .finally(()=>{this.voiceLoading=null;this.pumpVoice();});
  }
  announce(name){
    if(!VOICE_CLIPS[name]||!this.settings.voices||!this.settings.voiceVolume||!this.hasGesture||!this.visible)return false;
    if(this.voiceQueue.some(c=>c.name===name))return false;
    this.voiceQueue.push({name,at:Date.now()});if(this.voiceQueue.length>3)this.voiceQueue.shift();this.pumpVoice();return true;
  }
  pumpVoice(){
    if(this.voiceBusy||!this.visible||!this.settings.voices||!this.settings.voiceVolume||!this.hasGesture)return;
    this.voiceQueue=this.voiceQueue.filter(c=>Date.now()-c.at<2400);const call=this.voiceQueue[0];if(!call||!this.voiceBuffer&&this.voiceLoading)return;
    if(!(this.voiceBuffer&&this.ctx?.state==='running')&&!(this.voiceMedia&&this.voiceMedia.readyState!==0))return;
    const variants=VOICE_CLIPS[call.name];
    const variant=this.voiceChoices.next(call.name,variants.length);
    const clip=variants[variant],busy={name:call.name,variant};
    const done=()=>{if(this.voiceBusy!==busy)return;clearTimeout(busy.timer);this.voiceBusy=null;this.apply();this.notify();this.pumpVoice();};
    try{
      if(this.voiceBuffer&&this.ctx?.state==='running'){
        this.voiceQueue.shift();this.voiceBusy=busy;const source=this.ctx.createBufferSource();busy.source=source;
        source.buffer=this.voiceBuffer;source.connect(this.voiceGain);source.onended=()=>{source.disconnect();done();};this.apply();source.start(0,clip.offset,clip.duration);
      }else if(this.voiceMedia&&this.voiceMedia.readyState!==0){
        this.voiceQueue.shift();this.voiceBusy=busy;busy.native=true;this.voiceMedia.currentTime=clip.offset;this.voiceMedia.volume=this.settings.voiceVolume/100;this.apply();
        Promise.resolve(this.voiceMedia.play()).then(()=>{if(this.voiceBusy===busy)busy.timer=setTimeout(()=>{this.voiceMedia.pause();done();},clip.duration*1000);},()=>{this.voiceError='画面をタップするとボイスを再開できます';done();});
      }
    }catch{this.voiceBusy=null;if(this.voiceQueue[0]===call)this.voiceQueue.shift();this.apply();}
  }
  cancelVoices(){const busy=this.voiceBusy;this.voiceBusy=null;this.voiceQueue=[];clearTimeout(busy?.timer);try{busy?.source?.stop();}catch{}if(busy?.native)this.voiceMedia?.pause();this.apply();}
  resetFeedback(){this.cancelVoices();}
  tone(freq,when,length,type='sine',volume=.2,channel=this.effectsGain,glide){
    if(!this.ctx||!channel)return;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,when);if(glide)osc.frequency.exponentialRampToValueAtTime(glide,when+length);
    gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),when+.006);gain.gain.exponentialRampToValueAtTime(.0001,when+length);osc.connect(gain);gain.connect(channel);osc.start(when);osc.stop(when+length+.01);
  }
  hiss(when,length,volume,frequency=1800,type='highpass'){
    if(!this.ctx)return;const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();source.buffer=this.noise;filter.type=type;filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,when);gain.gain.exponentialRampToValueAtTime(.0001,when+length);source.connect(filter);filter.connect(gain);gain.connect(this.effectsGain);source.start(when);source.stop(when+length);
  }
  effect(name){
    // Deliberately silent: menu taps, turn ownership, errors and repeated fanfares.
    if(['click','turn','start','error','uno'].includes(name))return;
    if(!this.visible||!this.ctx||!this.settings.effects||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime;
    const variant=this.effectChoices.next(name);
    const v=[{pitch:.94,length:.95,brightness:.88,body:1},{pitch:1.03,length:.86,brightness:1.16,body:.94},{pitch:.99,length:1.08,brightness:.96,body:1.04},{pitch:1.08,length:.91,brightness:1.07,body:.9},{pitch:.97,length:1.03,brightness:1.22,body:.98}][variant];
    if(['tick','tick-match'].includes(name)){if(this.settings.alerts)this.tone(880*v.pitch,t,.045*v.length,'sine',.14*v.body);return;}
    if(name==='reversi-count'){this.tone(480*v.pitch,t,.030,'sine',.065*v.body,this.effectsGain,290);this.hiss(t,.012,.028,1800,'bandpass');return;}
    if(name==='oldmaid-pick'){this.hiss(t,.065*v.length,.08,2100*v.brightness,'highpass');return;}
    if(name==='oldmaid-draw'){this.hiss(t,.032,.10,1700,'bandpass');this.tone(310*v.pitch,t,.028,'triangle',.07,this.effectsGain,220);return;}
    if(name==='oldmaid-pair'){this.hiss(t,.045,.11,1900,'highpass');this.hiss(t+.07,.04,.08,1600,'bandpass');this.tone(560*v.pitch,t+.07,.10,'sine',.065);return;}
    if(name==='oldmaid-reveal'){this.hiss(t,.08,.07,1300,'bandpass');this.tone(220*v.pitch,t,.26,'sine',.10);this.tone(330*v.pitch,t+.09,.24,'sine',.075);this.tone(440*v.pitch,t+.18,.36,'sine',.06);return;}
    if(name==='reversi-place'){this.tone(390*v.pitch,t,.065*v.length,'sine',.13*v.body,this.effectsGain,270);this.hiss(t,.025,.045,1400,'bandpass');return;}
    if(name==='shogi-piece'){this.hiss(t,.022*v.length,.10,2000*v.brightness,'bandpass');this.tone(880*v.pitch,t,.047,'triangle',.15*v.body,this.effectsGain,620);this.tone(1460*v.pitch,t+.002,.026,'sine',.07);return;}
    if(name==='slam'){this.tone(95*v.pitch,t,.34*v.length,'sine',.9,this.effectsGain,38*v.pitch);this.tone(175*v.pitch,t+.015,.18,'triangle',.22*v.body,this.effectsGain,90);this.hiss(t,.16*v.length,.34,1100*v.brightness,'lowpass');this.hiss(t,.04,.18,3500*v.brightness);return;}
    if(name==='win'){this.tone([660,698,622,740,659][variant],t,.18,'sine',.18);this.tone([880,932,831,988,1046][variant],t+.15,.3*v.length,'sine',.15);return;}
    if(['deal','play','draw','reverse','skip','wild'].includes(name)){
      this.hiss(t,(name==='draw'?.085:.055)*v.length,(name==='deal'?.10:.16)*v.body,1600*v.brightness);
      this.tone((name==='draw'?320:name==='skip'?520:name==='reverse'?380:420)*v.pitch,t,.035*v.length,'triangle',(name==='deal'?.08:.12)*v.body,this.effectsGain,250*v.pitch);
    }
  }
  visibility(visible){this.visible=visible;if(!visible){this.stopMusic();this.testAudio?.pause();this.cancelVoices();this.voiceMedia?.pause();try{Promise.resolve(this.ctx?.suspend()).then(()=>{if(this.visible)this.unlock();},()=>{});}catch{}}
    else{this.apply();this.unlock();}this.notify();}
}
