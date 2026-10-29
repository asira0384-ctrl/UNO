"""Five restrained original wa-style flute/air pieces. No plucked strings."""
from pathlib import Path
import json, subprocess, tempfile, wave, hashlib
import numpy as np
from scipy.signal import butter,sosfilt
RATE=24000
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public2/assets/audio'
SCORES=[('木漏れ日の庭',50,[0,2,5,7,9],[0,2,3,2,0,1,2,0]),('月影の笛',48,[0,1,5,7,8],[0,3,2,1,0,2,1,0]),('竹の風',55,[0,2,3,7,8],[0,1,3,2,1,0,2,0]),('花灯り',53,[0,2,4,7,9],[2,3,4,2,1,0,2,0]),('水面の調べ',48,[0,2,5,7,10],[0,3,2,1,0,1,3,0])]
def flute(midi,dur,rng):
 t=np.arange(round(RATE*dur))/RATE;f=440*2**((midi-69)/12)
 phase=2*np.pi*np.cumsum(f*(1+.0012*np.sin(2*np.pi*4.1*t)))/RATE
 breath=sosfilt(butter(2,[650,2300],btype='bandpass',fs=RATE,output='sos'),rng.normal(0,1,len(t)))
 env=np.minimum(1,t/.32)*np.minimum(1,np.maximum(0,dur-t)/.55)
 return (np.sin(phase)+.055*np.sin(2*phase)+.018*breath)*env*.055
rows=[]
for i,(name,root,scale,melody) in enumerate(SCORES):
 rng=np.random.default_rng(22260+i);mix=np.zeros((60*RATE,2))
 def add(at,sig,pan=0):
  start=round(at*RATE);end=min(len(mix),start+len(sig))
  if end>start:mix[start:end]+=sig[:end-start,None]*np.sqrt([(1-pan)/2,(1+pan)/2])
 for n,degree in enumerate(melody):
  at=2+n*6.8+(i%2)*.45;dur=[2.4,3.1,2.8,3.6][(n+i)%4]
  add(at,flute(root+12+scale[degree],dur,rng),.12 if n%2 else -.12)
 # Barely audible sustained air: no rhythmic bass, strum or bright string attack.
 for at in [0,20,40]:
  t=np.arange(20*RATE)/RATE;env=np.sin(np.pi*t/20)**2
  tone=(np.sin(2*np.pi*440*2**((root-69)/12)*t)+.35*np.sin(2*np.pi*440*2**((root+7-69)/12)*t))*env*.009
  add(at,tone,0)
 dry=mix.copy()
 for d,g in [(.13,.045),(.27,.025)]:
  shift=round(d*RATE);mix[shift:]+=dry[:-shift,::-1]*g
 fade=RATE;mix[:fade]*=np.linspace(0,1,fade)[:,None];mix[-fade:]*=np.linspace(1,0,fade)[:,None]
 # Keep a consistent, quiet level; never normalize the sparse flute to full scale.
 target=OUT/f'hub-shogi-{i+1}.mp3'
 with tempfile.TemporaryDirectory() as tmp:
  src=Path(tmp)/'music.wav'
  with wave.open(str(src),'wb') as w:w.setparams((2,2,RATE,0,'NONE','not compressed'));w.writeframes((mix*32767).astype('<i2').tobytes())
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-codec:a','libmp3lame','-b:a','96k',str(target)],check=True)
 rows.append({'name':name,'file':f'/assets/audio/hub-shogi-{i+1}.mp3','duration':60,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()});print(name,flush=True)
(OUT/'shogi-music.json').write_text(json.dumps({'original':True,'instruments':'soft breath flute and very quiet sustained air; no plucked strings','tracks':rows},ensure_ascii=False,indent=2)+'\n')
