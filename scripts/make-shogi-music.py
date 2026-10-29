"""Five original, one-minute wa-style acoustic compositions. No samples."""
from pathlib import Path
import json, subprocess, tempfile, wave
import numpy as np
from scipy.signal import butter, sosfilt, lfilter

RATE=24000
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public2/assets/audio'
SCORES=[
 ('木漏れ日の庭',72,50,[0,2,5,7,9],[0,2,3,4,3,2,0,None,1,2,4,3,2,1,0,None]),
 ('月影の琴',64,48,[0,1,5,7,8],[0,None,3,2,1,None,0,2,4,3,None,2,1,0,None,None]),
 ('竹の風',68,55,[0,2,3,7,8],[0,1,3,None,4,3,2,None,1,3,2,0,None,1,0,None]),
 ('花灯り',80,53,[0,2,4,7,9],[2,3,4,3,2,0,1,None,3,4,2,1,0,2,0,None]),
 ('水面の調べ',60,48,[0,2,5,7,10],[0,3,2,None,1,2,3,None,4,None,2,1,0,1,0,None]),
]

def pluck(midi,duration,rng,volume=1,soft=False):
    n=int(RATE*duration);f=440*2**((midi-69)/12);delay=max(5,round(RATE/f))
    excite=np.zeros(n);seed=rng.normal(0,.5,min(delay,n))
    excite[:len(seed)]=seed
    # A damped string, with a rounded wooden resonator rather than a pure beep.
    a=np.zeros(delay+2);a[0]=1;a[delay]=-.496 if not soft else -.491;a[delay+1]=a[delay]
    tone=lfilter([1],a,excite)
    t=np.arange(n)/RATE
    tone+=.12*np.sin(2*np.pi*f*2.003*t)*np.exp(-5*t)
    tone=sosfilt(butter(2,4600 if not soft else 2500,fs=RATE,output='sos'),tone)
    tone*=np.minimum(1,t/.003)*np.minimum(1,(duration-t)/.1)
    peak=np.max(np.abs(tone));return (tone/max(.01,peak)*volume).astype(np.float32)

def flute(midi,duration,rng,volume=1):
    t=np.arange(round(RATE*duration))/RATE;f=440*2**((midi-69)/12)
    vibrato=.0025*np.sin(2*np.pi*4.8*t)*np.minimum(1,t/.8)
    phase=2*np.pi*np.cumsum(f*(1+vibrato))/RATE
    sig=np.sin(phase)+.13*np.sin(2*phase)+.035*np.sin(3*phase)
    breath=sosfilt(butter(2,[700,3500],btype='bandpass',fs=RATE,output='sos'),rng.normal(0,1,len(t)))
    envelope=np.minimum(1,t/.18)*np.minimum(1,np.maximum(0,duration-t)/.28)
    return ((sig+.06*breath)*envelope*volume*.7).astype(np.float32)

def compose(index,score):
    name,bpm,root,scale,melody=score;rng=np.random.default_rng(84120+index)
    mix=np.zeros((RATE*60,2),np.float64);beat=60/bpm
    def add(at,sig,pan=0):
        start=round(at*RATE);end=min(len(mix),start+len(sig))
        if start<0 or end<=start:return
        gains=np.sqrt([(1-pan)/2,(1+pan)/2])
        mix[start:end]+=sig[:end-start,None]*gains
    bars=int(60/(beat*4))+1
    for bar in range(bars):
        at=bar*4*beat;degree=[0,3,4,2,0,4,1,0][(bar+index)%8]
        base=root+scale[degree%5]
        add(at,pluck(base-12,3.2,rng,.1,True),-.15)
        # Quiet staggered koto strings, with an occasional octave response.
        for k,step in enumerate([0,2,4,2]):
            if (bar+k+index)%5!=3:add(at+k*beat,pluck(root+scale[(degree+step)%5]+(12 if k==2 else 0),2.8,rng,.075),-.33+k*.13)
        for half in range(4):
            note=melody[(bar*4+half)%len(melody)]
            if note is None:continue
            pitch=root+12+scale[note]
            if index in [1,4] and bar%4 in [2,3]:pitch-=12
            add(at+(half+.35)*beat,pluck(pitch,2.3,rng,.11),.22)
        if bar%4==2:
            for k,note in enumerate([2,1,0]):
                add(at+k*beat*1.2,flute(root+12+scale[(note+index)%5],beat*1.45,rng,.045),-.3)
        if bar%8==6:
            # A brief, descending harp gesture closes the phrase.
            for k in range(5):add(at+2*beat+k*.11,pluck(root+12+scale[4-k],1.6,rng,.035),.3-k*.12)
    # A tiny stereo room tail, never a loud or washed-out soundtrack.
    dry=mix.copy()
    for delay,gain in [(.057,.085),(.139,.055),(.227,.035)]:
        shift=round(delay*RATE);mix[shift:]+=dry[:-shift,::-1]*gain
    fade=round(RATE*.7);mix[:fade]*=np.linspace(0,1,fade)[:,None];mix[-fade:]*=np.linspace(1,0,fade)[:,None]
    mix*=.69/max(.01,float(np.max(np.abs(mix))))
    target=OUT/f'hub-shogi-{index+1}.mp3'
    with tempfile.TemporaryDirectory() as tmp:
        src=Path(tmp)/'composition.wav'
        with wave.open(str(src),'wb') as f:
            f.setparams((2,2,RATE,0,'NONE','not compressed'));f.writeframes((mix*32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-codec:a','libmp3lame','-b:a','96k',str(target)],check=True)
    print(f'{index+1}: {name} ({target.stat().st_size} bytes)',flush=True)
    return {'name':name,'file':f'/assets/audio/hub-shogi-{index+1}.mp3','bpm':bpm,'duration':60,'sha256':__import__('hashlib').sha256(target.read_bytes()).hexdigest()}

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    rows=[compose(i,score) for i,score in enumerate(SCORES)]
    (OUT/'shogi-music.json').write_text(json.dumps({'original':True,'instruments':'synthesized damped strings and breath flute; no samples','tracks':rows},ensure_ascii=False,indent=2)+'\n')
