"""Five original one-minute pieces: marimba, lounge, synth, piano, island."""
from pathlib import Path
import numpy as np
import math,os,subprocess,tempfile,wave
SR=44100
OUT=Path(__file__).resolve().parents[1]/'public/assets/audio'
def hz(m):return 440*2**((m-69)/12)
def tone(m,d,kind,amp):
    t=np.arange(round(SR*d))/SR;f=hz(m);a=np.minimum(t/.008,1)
    if kind=='pad':
        y=np.sin(2*np.pi*f*t)+.16*np.sin(2*np.pi*f*1.003*t)+.1*np.sin(2*np.pi*f*2*t);e=a*np.minimum((d-t)/.15,1)*.7
    elif kind=='keys':y=np.sin(2*np.pi*f*t+.38*np.sin(2*np.pi*f*2*t)*np.exp(-t*8));e=a*np.exp(-t*4.5)
    elif kind=='bass':y=np.sin(2*np.pi*f*t)+.13*np.sin(2*np.pi*f*2*t);e=a*np.exp(-t*3)*np.minimum((d-t)/.03,1)
    elif kind=='synth':y=np.sin(2*np.pi*f*t)+.24*np.sin(2*np.pi*f*2*t)+.11*np.sin(2*np.pi*f*3*t);e=a*np.exp(-t*6)
    elif kind=='steel':y=np.sin(2*np.pi*f*t+.75*np.sin(2*np.pi*f*2.003*t)*np.exp(-t*14));e=a*np.exp(-t*7)
    else:y=np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*f*3*t);e=a*np.exp(-t*12)
    return y*e*amp
configs=[(112,60,[0,5,9,7],'marimba',[0,2,4,7,9],.13),(94,50,[0,7,3,5],'keys',[0,3,5,7,10],.14),(126,57,[0,5,8,3],'synth',[0,2,3,7,10],.105),(82,60,[0,9,5,7],'keys',[0,2,4,7,11],.12),(104,62,[0,7,5,9],'steel',[0,2,4,7,9],.13)]
for k,(bpm,key,roots,kind,scale,melodyamp) in enumerate(configs):
    rng=np.random.default_rng(74100+k);beat=60/bpm;n=SR*60;track=np.zeros((n,2))
    def add(x,at,pan=0):
        i=round(at*SR)
        if i>=n:return
        x=x[:n-i]
        track[i:i+len(x),0]+=x*math.sqrt((1-pan)/2);track[i:i+len(x),1]+=x*math.sqrt((1+pan)/2)
    def drum(kind,at,amp=1):
        t=np.arange(round(SR*(.19 if kind=='kick' else .08)))/SR
        if kind=='kick':x=np.sin(2*np.pi*(45*t+4*(1-np.exp(-t*25))))*np.exp(-t*25)*.32
        else:
            x=rng.uniform(-1,1,len(t));x-=np.convolve(x,np.ones(7)/7,'same');x*=np.exp(-t*(90 if kind=='hat' else 45))*(.06 if kind=='hat' else .12)
        add(x*amp,at,.22 if kind=='hat' else 0)
    bars=math.ceil(60/(beat*4))
    for bar in range(bars):
        root=key+roots[(bar//2)%4];minor=k in (1,2);chord=[root,root+(3 if minor else 4),root+7,root+(10 if minor else 11)]
        # Distinct rhythms and instrument combinations, not pitch-shifted copies.
        for b in range(4):
            at=(bar*4+b)*beat
            if k!=3 and (b in ([0,2] if k in [0,1,4] else [0,1,2,3])):drum('kick',at,.8 if k==1 else 1)
            if k!=3 and b in [1,3]:drum('snare',at,.55 if k in [1,4] else .8)
            if k not in [1,3]:drum('hat',at+.5*beat)
            if k==3 and b==0:drum('hat',at,.25)
            if b in ([0,2] if k!=2 else [0,1,2,3]):add(tone(root-24+(7 if b==2 else 0),beat*.8,'bass',.24),at)
        for beatpos in ([.5,2,3.5] if k==4 else [0,1.5,2.5] if k==1 else [0,2] if k==3 else [.5,1.5,2.5,3.5]):
            for j,m in enumerate(chord[:3]):add(tone(m,beat*(2 if k==3 else .7),'pad' if k==3 else 'keys',.045),bar*4*beat+beatpos*beat,(-.4,.15,.4)[j])
        pattern=([0,3,5,7] if k==4 else [0,2,4,6,7] if k==2 else [0,3,6] if k==1 else [0,4,6] if k==3 else [0,2,3,6])
        if bar%8 in [6,7]:pattern=pattern[:-1]
        for j,step in enumerate(pattern):
            idx=(bar*2+j+(bar//8)*2)%len(scale);m=key+12+scale[idx]+(12 if k==0 and bar%8>3 else 0)
            add(tone(m,beat*(1.6 if k==3 else .65),kind,melodyamp),bar*4*beat+step*beat/2,(-.2 if j%2 else .2))
    track=np.tanh(track*1.35);track*=.86/max(.001,np.max(np.abs(track)))
    fade=round(.24*SR);track[:fade]*=np.linspace(0,1,fade)[:,None];track[-fade:]*=np.linspace(1,0,fade)[:,None]
    with tempfile.NamedTemporaryFile(suffix='.wav') as f:
        with wave.open(f.name,'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((track*32767).astype('<i2').tobytes())
        encoded=subprocess.check_output(['ffmpeg','-v','error','-i',f.name,'-c:a','libmp3lame','-b:a','160k','-metadata',f'title=UNO PARTY original scene {k+1}','-f','mp3','pipe:1'])
        # Finish the complete file before publishing it for a running preview.
        destination=OUT/f'scene-{k+1}.mp3'
        with tempfile.NamedTemporaryFile(dir=OUT,suffix='.mp3',delete=False) as audio:
            audio.write(encoded);audio.flush();os.fsync(audio.fileno());temporary=audio.name
        os.replace(temporary,destination)
    print(f'scene-{k+1}: {kind}, {bpm} BPM, 60 seconds')
