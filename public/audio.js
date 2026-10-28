// Original music is delivered as MP3 for reliable iPhone media playback.
// Effects use Web Audio, activated directly from a tap/click and resumed after interruptions.
import { VOICE_URL, VOICE_CLIPS } from './voices.js?v=1.2';

export class PartyAudio {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('uno-audio') || '{}'); } catch {}
    const volume=(v,f)=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):f;
    this.settings = { music: saved.music !== false, effects: saved.effects !== false, voices: saved.voices !== false,
      alerts: saved.alerts !== false, voiceVolume: volume(saved.voiceVolume,85),
      musicVolume: volume(saved.musicVolume,34), effectsVolume: volume(saved.effectsVolume,65) };
    this.ctx = null; this.timer = null; this.step = 0; this.nextAt = 0;
    this.visible = typeof document === 'undefined' || !document.hidden;
    this.hasGesture = false; this.bgm = null; this.testAudio = null; this.bgmError = '';
    this.contextError = ''; this.listeners = new Set();
    this.voiceQueue = []; this.voiceBusy = null; this.voiceBuffer = null; this.voiceLoading = null;
    this.voiceMedia = null; this.voiceError = '';
  }
  subscribe(fn) { this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  notify() { for(const fn of this.listeners)fn(this.status()); }
  status() {
    return { activated: this.hasGesture, musicPlaying: !!this.bgm && !this.bgm.paused && !this.bgmError,
      context: this.ctx?.state || 'not-started', error: this.bgmError || this.contextError,
      voiceReady: !!this.voiceBuffer || !!this.voiceMedia && this.voiceMedia.readyState >= 1,
      voiceError: this.voiceError,
      needsTap: !this.hasGesture || (this.settings.music && this.settings.musicVolume>0 && (!this.bgm || this.bgm.paused)) ||
        (this.settings.effects && this.ctx?.state !== 'running') || (this.settings.voices && !!this.voiceError) };
  }
  configureSession() {
    // iOS defaults Web Audio to "ambient", which obeys the ringer switch.
    // Playback is appropriate here because the player explicitly enables game audio.
    try { if(navigator.audioSession && navigator.audioSession.type !== 'playback')navigator.audioSession.type='playback'; } catch {}
  }
  unlock({gesture=false}={}) {
    if(gesture)this.hasGesture=true;
    if(!this.hasGesture || !this.visible)return false;
    this.configureSession();
    // Call media play synchronously inside the trusted gesture, before any await.
    if(this.settings.music && this.settings.musicVolume>0)this.startMusic();
    if(gesture && this.settings.voices)this.primeVoiceMedia();
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx.onstatechange=()=>{if(this.ctx.state==='running'){this.contextError='';this.apply();this.pumpVoice();}this.notify();};
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -14; compressor.ratio.value = 5;
        compressor.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain(); this.musicGain.connect(compressor);
        this.effectsGain = this.ctx.createGain(); this.effectsGain.connect(compressor);
        this.voiceGain = this.ctx.createGain(); this.voiceGain.connect(compressor);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * .25, this.ctx.sampleRate);
        const values = this.noise.getChannelData(0);
        for (let i=0; i<values.length; i++) values[i] = Math.random()*2-1;
        this.apply();
      }
      // Prime the graph during touchend/click. A resume promise may remain pending
      // on iOS; it must never prevent the independent native BGM from starting.
      const source=this.ctx.createBufferSource();source.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);
      source.connect(this.ctx.destination);source.start(0);source.onended=()=>source.disconnect();
      if (this.ctx.state !== 'running') {
        Promise.resolve(this.ctx.resume()).then(()=>{this.apply();this.notify();},()=>{this.contextError='効果音は画面をタップして再開できます';this.notify();});
      }
      this.apply();
      this.prepareVoices();
    } catch { this.contextError='このブラウザでは効果音を開始できません'; }
    this.notify();return true;
  }
  set(key, value) {
    if(!['music','effects','voices','alerts','musicVolume','effectsVolume','voiceVolume'].includes(key))return;
    this.settings[key] = key.endsWith('Volume') ? Math.max(0,Math.min(100,Number(value)||0)) : value===true;
    try { localStorage.setItem('uno-audio', JSON.stringify(this.settings)); } catch {}
    this.apply();
    if(!this.settings.voices || !this.settings.voiceVolume)this.cancelVoices();
    if (this.settings.music && this.settings.musicVolume>0 && this.visible) this.unlock(); else this.stopMusic();
    this.notify();
  }
  apply() {
    if(this.bgm)this.bgm.volume=this.settings.musicVolume/100*.65*(this.voiceBusy ? .65 : 1);
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.music ? this.settings.musicVolume / 100 * .47 : 0, at,.035);
    this.effectsGain.gain.setTargetAtTime(this.settings.effects ? this.settings.effectsVolume / 100 * .62 : 0, at,.02);
    this.voiceGain?.gain.setTargetAtTime(this.settings.voices ? this.settings.voiceVolume / 100 : 0, at,.02);
  }
  tone(freq, when, length, type='sine', volume=.2, channel=this.musicGain, glide) {
    if (!this.ctx || !channel) return;
    const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
    osc.type=type; osc.frequency.setValueAtTime(freq,when);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide,when+length);
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),when+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,when+length);
    osc.connect(gain); gain.connect(channel); osc.start(when); osc.stop(when+length+.015);
  }
  hiss(when,length,volume,frequency=5000,channel=this.musicGain) {
    if (!this.ctx) return;
    const source=this.ctx.createBufferSource(), gain=this.ctx.createGain(), filter=this.ctx.createBiquadFilter();
    source.buffer=this.noise; filter.type='highpass'; filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,when); gain.gain.exponentialRampToValueAtTime(.0001,when+length);
    source.connect(filter); filter.connect(gain); gain.connect(channel); source.start(when); source.stop(when+length);
  }
  startMusic() {
    if(!this.hasGesture || !this.visible || !this.settings.music || this.settings.musicVolume===0)return;
    try {
      if(!this.bgm) {
        this.bgm=new Audio('/assets/audio/party-loop.mp3?v=1.2');
        this.bgm.loop=true;this.bgm.preload='auto';this.bgm.setAttribute('playsinline','');
        this.bgm.addEventListener('playing',()=>{this.bgmError='';this.notify();});
        this.bgm.addEventListener('pause',()=>this.notify());
        this.bgm.addEventListener('error',()=>{this.bgmError='音声ファイルを読み込めません。ページを再読み込みしてね';this.notify();});
      }
      this.apply();
      if(this.bgm.paused)Promise.resolve(this.bgm.play()).then(()=>{
        if(!this.visible || !this.settings.music || this.settings.musicVolume===0)this.bgm.pause();
        this.bgmError='';this.notify();
      },()=>{this.bgmError='「音を開始」をタップしてね';this.notify();});
    } catch { this.bgmError='音楽の再生を開始できません';this.notify(); }
  }
  stopMusic() { this.bgm?.pause(); }
  primeVoiceMedia() {
    // One native media element is unlocked on the initial tap as a fallback for
    // iOS interruptions. The beginning of this sprite contains only silence.
    if(this.voiceBusy || this.voiceMedia && !this.voiceError)return;
    try {
      if(!this.voiceMedia){
        this.voiceMedia=new Audio(VOICE_URL);
        this.voiceMedia.addEventListener('loadedmetadata',()=>this.pumpVoice());
      }
      this.voiceMedia.preload='auto';this.voiceMedia.setAttribute('playsinline','');
      this.voiceMedia.currentTime=0;
      Promise.resolve(this.voiceMedia.play()).then(()=>{
        if(!this.voiceBusy)this.voiceMedia.pause();this.voiceError='';this.notify();
      },()=>{this.voiceError='ボイスは「音を開始」で再開できます';this.notify();});
    } catch { this.voiceError='ボイスを開始できません'; }
  }
  prepareVoices() {
    if(this.voiceBuffer || this.voiceLoading || !this.ctx?.decodeAudioData || typeof fetch!=='function')return;
    const ctx=this.ctx;
    this.voiceLoading=fetch(VOICE_URL).then(r=>{if(!r.ok)throw Error('voice');return r.arrayBuffer();})
      .then(bytes=>ctx.decodeAudioData(bytes)).then(buffer=>{this.voiceBuffer=buffer;this.voiceError='';this.pumpVoice();this.notify();})
      .catch(()=>{this.voiceError='ボイスの読み込みを再試行できます';this.notify();})
      .finally(()=>{this.voiceLoading=null;this.pumpVoice();});
  }
  announce(name) {
    if(!VOICE_CLIPS[name] || !this.settings.voices || !this.settings.voiceVolume || !this.hasGesture || !this.visible)return false;
    if(this.voiceBusy?.name===name || this.voiceQueue.some(q=>q.name===name))return false;
    this.voiceQueue.push({name,at:Date.now()});
    if(this.voiceQueue.length>5)this.voiceQueue.shift();
    this.pumpVoice();return true;
  }
  pumpVoice() {
    if(this.voiceBusy || !this.visible || !this.settings.voices || !this.settings.voiceVolume || !this.hasGesture)return;
    this.voiceQueue=this.voiceQueue.filter(q=>Date.now()-q.at<3000);
    const call=this.voiceQueue[0];if(!call)return;
    // Wait for a pending decode rather than overlap a native and Web Audio call.
    if(!this.voiceBuffer && this.voiceLoading)return;
    const clip=VOICE_CLIPS[call.name],busy={name:call.name};
    const done=()=>{if(this.voiceBusy!==busy)return;this.voiceBusy=null;this.apply();this.pumpVoice();};
    try {
      if(this.voiceBuffer && this.ctx?.state==='running') {
        this.voiceQueue.shift();this.voiceBusy=busy;
        const source=this.ctx.createBufferSource();busy.source=source;
        source.buffer=this.voiceBuffer;source.connect(this.voiceGain);source.onended=()=>{source.disconnect();done();};
        this.apply();source.start(0,clip.offset,clip.duration);
      } else if(this.voiceMedia && this.voiceMedia.readyState!==0) {
        this.voiceQueue.shift();this.voiceBusy=busy;busy.native=true;
        this.voiceMedia.currentTime=clip.offset;this.voiceMedia.volume=this.settings.voiceVolume/100;
        this.apply();
        Promise.resolve(this.voiceMedia.play()).then(()=>{
          if(this.voiceBusy!==busy)return;
          busy.timer=setTimeout(()=>{this.voiceMedia.pause();done();},clip.duration*1000);
        },()=>{this.voiceError='ボイスは画面をタップして再開できます';done();this.notify();});
      }
    } catch { this.voiceBusy=null;this.voiceQueue.shift();this.apply(); }
  }
  cancelVoices() {
    this.voiceQueue=[];const busy=this.voiceBusy;this.voiceBusy=null;
    if(busy){clearTimeout(busy.timer);try{busy.source?.stop();}catch{}if(busy.native)this.voiceMedia?.pause();}
    this.apply();
  }
  resetFeedback() { this.cancelVoices(); }
  async test() {
    this.unlock({gesture:true});
    try {
      this.testAudio ||= new Audio('/assets/audio/sound-test.mp3?v=1.2');
      this.testAudio.setAttribute('playsinline','');this.testAudio.volume=.65;this.testAudio.currentTime=0;
      await this.testAudio.play();return true;
    } catch { return false; }
  }
  effect(name) {
    if(!this.visible || !this.ctx || !this.settings.effects || this.ctx.state!=='running') return;
    if(['warning','round-warning','tick','tick-fast','tick-match'].includes(name) && !this.settings.alerts)return;
    const t=this.ctx.currentTime, g=this.effectsGain;
    const note=(f,d=.12,v=.3,delay=0,type='sine',glide)=>this.tone(f,t+delay,d,type,v,g,glide);
    if(name==='click') note(650,.065,.12,0,'sine',900);
    else if(name==='play') { this.hiss(t,.075,.16,1500,g); note(430,.12,.2,0,'triangle',750); }
    else if(name==='draw') { this.hiss(t,.15,.2,1900,g); note(420,.12,.14,0,'sine',260); }
    else if(name==='reverse') { note(400,.18,.2,0,'triangle',820); note(820,.18,.2,.12,'triangle',300); }
    else if(name==='skip') { note(700,.09,.22); note(420,.13,.22,.1); }
    else if(name==='wild') [523.25,659.25,783.99,1046.5].forEach((f,i)=>note(f,.22,.19,i*.07,'triangle'));
    else if(name==='uno') [523.25,783.99,1046.5].forEach((f,i)=>note(f,.24,.3,i*.09,'triangle'));
    else if(name==='start') [392,523.25,659.25,783.99].forEach((f,i)=>note(f,.2,.24,i*.1,'triangle'));
    else if(name==='win') [523.25,659.25,783.99,1046.5,783.99,1046.5].forEach((f,i)=>note(f,i===5?.65:.24,.28,i*.16,'triangle'));
    else if(name==='error') { note(220,.12,.2); note(185,.18,.16,.12); }
    else if(name==='turn') { note(659.25,.13,.18); note(880,.22,.15,.09); }
    else if(name==='warning') { note(740,.13,.2,0,'triangle');note(740,.13,.2,.18,'triangle'); }
    else if(name==='round-warning') [660,880,660].forEach((f,i)=>note(f,.13,.22,i*.13,'triangle'));
    else if(name==='tick') note(1050,.075,.22,0,'sine');
    else if(name==='tick-fast') { note(1320,.055,.26);note(1320,.055,.23,.12); }
    else if(name==='tick-match') note(880,.12,.23,0,'triangle');
  }
  visibility(visible) {
    this.visible=visible;
    if(!visible) {
      this.stopMusic();this.testAudio?.pause();this.cancelVoices();this.voiceMedia?.pause();
      try { Promise.resolve(this.ctx?.suspend()).then(()=>{if(this.visible)this.unlock();},()=>{}); } catch {}
    } else { this.apply();this.unlock(); }
    this.notify();
  }
}
