"""Compose original 5-section music per game; no samples or network required."""
from pathlib import Path
import math, subprocess, tempfile, wave
import numpy as np
RATE=24000
ROOT=Path(__file__).resolve().parents[1]/'public2/assets/audio'
PROFILES={
 'shogi':(76,[0,2,5,7,9],48,'wood'),
 'reversi':(90,[0,3,5,7,10],50,'bell'),
 'oldmaid':(108,[0,2,4,7,9],55,'plucky'),
 'president':(104,[0,2,4,5,7,9,11],48,'keys'),
 'poker':(86,[0,3,5,7,10],43,'keys'),
 'speed':(132,[0,2,4,7,9],52,'pulse'),
 'memory':(96,[0,2,4,7,9],60,'bell'),
 'blackjack':(94,[0,3,5,7,10],45,'keys')}
def note(midi,dur,kind,volume=.14):
 t=np.arange(int(RATE*dur))/RATE;f=440*2**((midi-69)/12)
 if kind=='bell': sig=np.sin(2*np.pi*f*t)*np.exp(-3*t)+.28*np.sin(2*np.pi*f*2.004*t)*np.exp(-6*t)
 elif kind=='wood': sig=np.sin(2*np.pi*f*t)*np.exp(-9*t)+.2*np.sin(2*np.pi*f*3*t)*np.exp(-16*t)
 elif kind=='pulse': sig=np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2*t)+.1*np.sin(2*np.pi*f*3*t)
 else: sig=np.sin(2*np.pi*f*t)*np.exp(-3.5*t)+.18*np.sin(2*np.pi*f*2*t)*np.exp(-6*t)
 env=np.minimum(1,t/.018)*np.minimum(1,np.maximum(0,dur-t)/.07)
 return (sig*env*volume).astype(np.float32)
def compose(name,profile):
 bpm,scale,root,kind=profile;seconds=300;mix=np.zeros(RATE*seconds,dtype=np.float32)
 def add(at,sig):
  i=int(at*RATE);end=min(len(mix),i+len(sig))
  if end>i:mix[i:end]+=sig[:end-i]
 for section in range(5):
  beat=60/(bpm+[0,2,-2,4,0][section]);start=section*60
  chord_degrees=[[0,3,4,1],[0,4,3,0],[3,1,4,0],[0,2,3,4],[0,4,1,3]][section]
  nbeats=int(60/beat)
  for b in range(nbeats):
   at=start+b*beat;degree=chord_degrees[(b//8)%4];base=root+scale[degree%len(scale)]
   if b%2==0:add(at,note(base-12,min(beat*1.7,.9),'keys',.13))
   if b%4 in (0,2):
    for interval in [0,7,12]:add(at+.025,note(base+interval,min(beat*2,1.6),'keys',.035))
   melodic=[0,2,1,4,2,0,3,1,4,2,1,0,2,4,3,1][(b+section*3)%16]
   if (b+section)%4!=3:add(at+beat*.5,note(root+12+scale[(melodic+degree)%len(scale)],min(.75,beat*.85),kind,.065))
   if kind not in ['wood','bell']:
    # Quiet original kick and tap; no audio samples.
    t=np.arange(int(RATE*.10))/RATE
    if b%2==0:add(at,(np.sin(2*np.pi*(55*t+5*(1-np.exp(-35*t))))*np.exp(-40*t)*.075).astype(np.float32))
   # A short fade around minute boundaries keeps all five sections smooth.
  left=int(start*RATE);right=int((start+60)*RATE);ramp=int(RATE*.18)
  mix[left:left+ramp]*=np.linspace(0,1,ramp)
  mix[right-ramp:right]*=np.linspace(1,0,ramp)
 peak=float(np.max(np.abs(mix)));mix*=.62/max(peak,.01)
 with tempfile.TemporaryDirectory() as tmp:
  src=Path(tmp)/'music.wav'
  with wave.open(str(src),'wb') as f:f.setparams((1,2,RATE,0,'NONE','not compressed'));f.writeframes((mix*32767).astype('<i2').tobytes())
  target=ROOT/('hub-'+name+'.mp3')
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-codec:a','libmp3lame','-b:a','80k',str(target)],check=True)
  print(name,target.stat().st_size,flush=True)
if __name__=='__main__':
 ROOT.mkdir(parents=True,exist_ok=True)
 for name,profile in PROFILES.items():compose(name,profile)
