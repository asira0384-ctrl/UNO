"""Generate the project's original music and test sound. Dev only: numpy + ffmpeg."""
from pathlib import Path
import math, subprocess, wave, tempfile
import numpy as np

SR = 44100
BPM = 112
BEAT = 60 / BPM
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'audio'
ROOT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(2601028)

def add(track, samples, when, pan=0):
    at = int(when*SR)
    for channel, volume in [(0, math.sqrt((1-pan)/2)), (1, math.sqrt((1+pan)/2))]:
        indexes = (np.arange(len(samples)) + at) % len(track)
        np.add.at(track[:,channel],indexes,samples*volume)

def note(freq, length, kind='pluck', volume=.2):
    t = np.arange(int(length*SR))/SR
    envelope = np.minimum(t/.006,1)*np.exp(-t/(length*.24))
    if kind == 'bass':
        envelope = np.minimum(t/.012,1)*np.minimum((length-t)/.03,1)*np.exp(-t/(length*.9))
        signal = np.sin(2*np.pi*freq*t)+.15*np.sin(4*np.pi*freq*t)
    elif kind == 'bell':
        signal = np.sin(2*np.pi*freq*t + .7*np.sin(2*np.pi*freq*2*t)*np.exp(-t*20))
    else:
        signal = np.sin(2*np.pi*freq*t)+.23*np.sin(4*np.pi*freq*t)+.07*np.sin(6*np.pi*freq*t)
    return signal*envelope*volume

def drum(kind):
    length = .24 if kind=='kick' else .14 if kind=='snare' else .045
    t = np.arange(int(length*SR))/SR
    if kind=='kick':
        phase = 2*np.pi*(45*t+5.3*(1-np.exp(-t*22)))
        return np.sin(phase)*np.exp(-t*23)*.52
    noise = rng.uniform(-1,1,len(t))
    if kind=='hat':
        noise = noise - np.convolve(noise,np.ones(5)/5,'same')
        return noise*np.exp(-t*110)*.1
    return (noise*.65+np.sin(2*np.pi*185*t)*.35)*np.exp(-t*37)*.19

def save(track, name, bitrate='160k'):
    track = np.tanh(track*1.2)
    peak = np.max(np.abs(track))
    if peak: track = track / peak * .82
    with tempfile.NamedTemporaryFile(suffix='.wav') as temp:
        with wave.open(temp.name,'wb') as output:
            output.setnchannels(2); output.setsampwidth(2); output.setframerate(SR)
            output.writeframes((track*32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-v','error','-y','-i',temp.name,'-codec:a','libmp3lame','-b:a',bitrate,
            '-metadata','title=UNO PARTY — original composition','-metadata','artist=UNO PARTY',str(ROOT/name)],check=True)

duration = 16*4*BEAT
music = np.zeros((round(duration*SR),2),dtype=np.float64)
chords = [[146.83,174.61,220,293.66],[116.54,146.83,174.61,233.08],
          [130.81,174.61,220,261.63],[130.81,164.81,196,261.63]]
melody = [0,-1,2,-1,1,-1,3,2,-1,-1,2,-1,1,0,-1,2]
for bar in range(16):
    chord = chords[bar%4]
    for step in range(16):
        at = (bar*16+step)*BEAT/4
        if step%4==0: add(music,drum('kick'),at)
        if step in (4,12): add(music,drum('snare'),at)
        if step%2==0: add(music,drum('hat'),at, .25 if step%4 else -.25)
        if step in (0,3,6,8,11,14): add(music,note(chord[0]/2*(2 if step==14 else 1),.22,'bass',.30),at)
        if step in (2,6,10,14):
            for j,frequency in enumerate(chord[1:]): add(music,note(frequency*2,.22,'pluck',.065),at,(-.4,.2,.4)[j])
        index = melody[(step+(2 if bar//4%2 else 0))%16]
        if index>=0: add(music,note(chord[index]*2*(2 if bar>=8 else 1),.26,'bell',.13),at+(.012 if step%2 else 0),.1)
save(music,'party-loop.mp3')
test = np.zeros((int(SR*.85),2))
for i,f in enumerate((523.25,659.25,783.99)): add(test,note(f,.34,'bell',.25),i*.14)
save(test,'sound-test.mp3','128k')
print({'music_seconds':round(duration,2),'assets':[p.name for p in ROOT.iterdir()]})
