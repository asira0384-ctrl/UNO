// Original, procedurally composed music. No external audio, trackers, or samples.
export class PartyAudio {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('uno-audio') || '{}'); } catch {}
    this.settings = { music: true, effects: true, musicVolume: 34, effectsVolume: 65, ...saved };
    this.ctx = null; this.timer = null; this.step = 0; this.nextAt = 0;
    this.visible = true;
  }
  async unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -14; compressor.ratio.value = 5;
        compressor.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain(); this.musicGain.connect(compressor);
        this.effectsGain = this.ctx.createGain(); this.effectsGain.connect(compressor);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * .25, this.ctx.sampleRate);
        const values = this.noise.getChannelData(0);
        for (let i=0; i<values.length; i++) values[i] = Math.random()*2-1;
        this.apply();
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (this.settings.music && this.visible) this.startMusic();
    } catch { /* A browser without audio can still play the game. */ }
  }
  set(key, value) {
    this.settings[key] = value;
    try { localStorage.setItem('uno-audio', JSON.stringify(this.settings)); } catch {}
    this.apply();
    if (this.settings.music && this.visible) { this.unlock(); } else this.stopMusic();
  }
  apply() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.music ? this.settings.musicVolume / 100 * .47 : 0, at,.035);
    this.effectsGain.gain.setTargetAtTime(this.settings.effects ? this.settings.effectsVolume / 100 * .62 : 0, at,.02);
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
    if (!this.ctx || this.timer || this.ctx.state !== 'running') return;
    this.nextAt=this.ctx.currentTime+.07;
    const schedule=()=>{
      if (!this.ctx || this.ctx.state !== 'running') return;
      while (this.nextAt < this.ctx.currentTime+.24) {
        this.musicStep(this.step++,this.nextAt); this.nextAt+=60/112/4;
      }
    };
    schedule(); this.timer=setInterval(schedule,75);
  }
  stopMusic() { clearInterval(this.timer); this.timer=null; if(this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(0,this.ctx.currentTime,.04); }
  musicStep(step,t) {
    const i=step%16, bar=Math.floor(step/16)%4;
    const chords=[[146.83,174.61,220,293.66],[116.54,146.83,174.61,233.08],[130.81,174.61,220,261.63],[130.81,164.81,196,261.63]];
    const chord=chords[bar], beat=60/112;
    if (i%4===0) this.tone(125,t,.17,'sine',.55,this.musicGain,42);
    if (i===4 || i===12) { this.hiss(t,.11,.11,1400); this.tone(185,t,.09,'triangle',.1); }
    if (i%2===0) this.hiss(t,.035,i%4===2?.075:.04,6800);
    if ([0,3,6,8,11,14].includes(i)) this.tone(chord[0]/2*(i===14?2:1),t,.19,'triangle',.3);
    if ([2,6,10,14].includes(i)) for(const f of chord.slice(1)) this.tone(f*2,t,.15,'sine',.065);
    const melody=[0,-1,2,-1,1,-1,3,2,-1,-1,2,-1,1,0,-1,2];
    if(melody[i]>=0) this.tone(chord[melody[i]]*4,t+(i%2?.012:0),beat*.42,'triangle',.075);
  }
  effect(name) {
    if(!this.ctx || !this.settings.effects || this.ctx.state!=='running') return;
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
  }
  visibility(visible) {
    this.visible=visible;
    if(!visible) { this.stopMusic(); this.ctx?.suspend().catch(()=>{}); }
    else if(this.ctx) { this.apply(); this.unlock(); }
  }
}
