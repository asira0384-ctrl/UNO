import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {VariationBag} from '../public/variations.js';
import {VOICE_CLIPS} from '../public/voice-clips.js';

test('each sound uses all five alternatives before repeating, including shuffle boundaries',()=>{
  for(const random of [()=>0,()=>.999,Math.random]){
    const bag=new VariationBag(random);let previous;
    for(let round=0;round<20;round++){
      const values=Array.from({length:5},()=>bag.next('reverse'));
      assert.equal(new Set(values).size,5);if(previous!==undefined)assert.notEqual(values[0],previous);previous=values.at(-1);
    }
  }
});
test('one sound cannot consume the alternatives of another sound',()=>{
  const a=new VariationBag(()=>.4),b=new VariationBag(()=>.4);
  assert.equal(a.next('red'),b.next('red'));for(let i=0;i<21;i++)a.next('blue');assert.equal(a.next('red'),b.next('red'));
});
test('all seven calls ship five distinct new audio files with nonoverlapping sprite ranges',async()=>{
  assert.deepEqual(Object.keys(VOICE_CLIPS).sort(),['blue','green','red','reverse','skip','uno','yellow']);
  let end=0,count=0;
  for(const alternatives of Object.values(VOICE_CLIPS)){
    assert.equal(alternatives.length,5);const hashes=new Set();
    for(const clip of alternatives){
      assert.ok(clip.offset>=end+.09);assert.ok(clip.duration>.22&&clip.duration<1.65);end=clip.offset+clip.duration;
      const data=await readFile(new URL('../public'+clip.file,import.meta.url));assert.ok(data.length>5000);hashes.add(createHash('sha256').update(data).digest('hex'));count++;
    }
    assert.equal(hashes.size,5);
  }
  assert.equal(count,35);const report=JSON.parse(await readFile(new URL('../public/assets/audio/voice-production.json',import.meta.url),'utf8'));
  assert.equal(report.count,35);assert.equal(report.engine,'Kokoro-82M ONNX');assert.ok(report.clips.every(c=>c.peak<=.9));
});
