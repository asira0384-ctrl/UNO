"""Five newly synthesized Japanese '王手' calls, appended to the phone sprite.

Dev-only: kokoro-onnx, misaki, pyopenjtalk-plus, scipy, numpy and ffmpeg.
Set UNO_VOICE_MODELS to the Kokoro-82M ONNX model directory. Only MP3s ship.
"""
import os
os.environ['ORT_DISABLE_TELEMETRY']='1'
from pathlib import Path
import json, re, subprocess, tempfile
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()
from kokoro_onnx import Kokoro
from misaki import ja
from scipy.signal import butter,sosfilt,resample_poly

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public2/assets/audio';VOICE=OUT/'voice';RATE=48000
MODELS=Path(os.environ['UNO_VOICE_MODELS'])
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
session=ort.InferenceSession(str(MODELS/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
model=Kokoro.from_session(session,str(MODELS/'voices-v1.0.bin'));g2p=ja.JAG2P()
TAKES=[(.70,.24,.06,1.03,'!'),(.62,.28,.10,1.09,'!'),(.76,.16,.08,.98,'。'),(.65,.20,.15,1.05,'！'),(.69,.27,.04,1.12,'!')]

def mp3(path,samples):
    with tempfile.NamedTemporaryFile(suffix='.mp3',dir=path.parent,delete=False) as f:temporary=f.name
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','pipe:0','-codec:a','libmp3lame','-b:a','192k','-write_xing','1',temporary],input=samples.astype('<f4').tobytes(),check=True)
    os.replace(temporary,path)

manifest=ROOT/'public/voice-clips.js'
text=manifest.read_text();clips=json.loads(re.search(r'export const VOICE_CLIPS=(.*);',text).group(1));clips.pop('check',None)
base=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(OUT/'voice-calls.mp3'),'-f','f32le','-ar',str(RATE),'-ac','2','pipe:1']),dtype='<f4').reshape(-1,2)
end=round((max(v['offset']+v['duration'] for rows in clips.values() for v in rows)+.14)*RATE)
base=base[:end];parts=[base,np.zeros((round(.25*RATE),2))];offset=(len(base)+round(.25*RATE))/RATE;clips['check']=[];report=[]
for i,(a,b,c,speed,punct) in enumerate(TAKES):
    phonemes,_=g2p('王手'+punct)
    style=model.voices['jf_alpha']*a+model.voices['jf_tebukuro']*b+model.voices['jm_kumo']*c
    samples,sr=model.create(phonemes,voice=style,speed=speed,is_phonemes=True,trim=False)
    samples=np.asarray(samples,np.float64);block=round(sr*.01)
    rms=np.array([np.sqrt(np.mean(samples[j:j+block]**2)) for j in range(0,len(samples),block)])
    voiced=np.flatnonzero(rms>max(.003,float(rms.max())*.025))
    if not len(voiced):raise ValueError('Silent call')
    samples=samples[max(0,voiced[0]*block-round(sr*.025)):min(len(samples),(voiced[-1]+1)*block+round(sr*.075))]
    samples=sosfilt(butter(2,90,btype='highpass',fs=sr,output='sos'),samples)
    samples+=.045*sosfilt(butter(2,[800,3200],btype='bandpass',fs=sr,output='sos'),samples)
    samples*=min(.2/max(.001,np.sqrt(np.mean(samples*samples))),.87/max(.001,np.max(np.abs(samples))))
    fade=round(sr*.008);samples[:fade]*=np.linspace(0,1,fade);samples[-fade:]*=np.linspace(1,0,fade)
    samples=resample_poly(samples,RATE,sr);stereo=np.repeat(samples[:,None],2,axis=1);duration=len(stereo)/RATE
    if not .25<duration<1.8:raise ValueError(f'Unexpected word duration: {duration}')
    path=VOICE/f'check-{i+1}.mp3';mp3(path,stereo)
    clips['check'].append({'id':f'check-{i+1}','offset':round(offset,6),'duration':round(duration,6),'file':f'/assets/audio/voice/check-{i+1}.mp3','delivery':['clear','bright','calm','firm','quick'][i]})
    report.append({'id':f'check-{i+1}','duration':duration,'phonemes':phonemes})
    parts.extend([stereo,np.zeros((round(.14*RATE),2))]);offset+=duration+.14
    print('王手',i+1,round(duration,3),'seconds',flush=True)
mp3(OUT/'voice-calls.mp3',np.concatenate(parts))
manifest.write_text('// UNO calls and newly synthesized Japanese shogi calls.\nexport const VOICE_FILE="/assets/audio/voice-calls.mp3?v=2.1";\nexport const VOICE_CLIPS='+json.dumps(clips,separators=(',',':'))+';\n')
(OUT/'shogi-voice-production.json').write_text(json.dumps({'engine':'Kokoro-82M ONNX Japanese neural','text':'王手','takes':report,'sample_rate':RATE,'not_human_recorded':True},ensure_ascii=False,indent=2)+'\n')
