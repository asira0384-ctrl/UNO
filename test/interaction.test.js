import test from 'node:test';
import assert from 'node:assert/strict';
import {CardInput,insideDropZone} from '../public/interaction.js';
import {THEMES,themeIndex} from '../public/themes.js';
import {fitHand} from '../public/layout.js';

const zone={left:100,top:100,right:220,bottom:250};
test('one tap selects and a second quick tap on the same card commits',()=>{
  const c=new CardInput();c.down('red-2',20,450,0);assert.equal(c.up(20,450,80,zone).commit,false);assert.equal(c.selected,'red-2');
  c.down('red-2',20,450,180);assert.equal(c.up(20,450,240,zone).commit,true);
});
test('a different card and slow taps only change the selection',()=>{
  const c=new CardInput();c.down('a',0,400,0);c.up(0,400,50,zone);c.down('b',0,400,80);assert.equal(c.up(0,400,100,zone).commit,false);
  c.down('b',0,400,700);assert.equal(c.up(0,400,750,zone).commit,false);
});
test('holding and dragging into the center commits; releasing outside returns it',()=>{
  const c=new CardInput();c.down('a',20,450,0);assert.equal(c.move(24,445,200).dragging,true);c.move(150,180,400);
  assert.equal(c.up(150,180,450,zone).commit,true);
  c.down('b',20,450,1000);c.move(60,400,1100);assert.equal(c.up(60,400,1200,zone).commit,false);
});
test('a cancelled drag cannot commit or count as half of a double tap',()=>{
  const c=new CardInput();c.down('a',20,450,0);c.move(140,180,200);c.cancel();assert.equal(c.up(150,180,300,zone),null);
  c.down('a',20,450,320);assert.equal(c.up(20,450,350,zone).commit,false);
});
test('the center drop target has a small touch-friendly margin',()=>{
  assert.equal(insideDropZone(90,180,zone),true);assert.equal(insideDropZone(70,180,zone),false);assert.equal(insideDropZone(150,180,null),false);
});
test('the five music and table themes rotate on exact minute boundaries',()=>{
  assert.equal(THEMES.length,5);assert.equal(new Set(THEMES.map(t=>t.music)).size,5);assert.equal(new Set(THEMES.map(t=>t.background)).size,5);
  for(let minute=0;minute<20;minute++){assert.equal(themeIndex(minute*60000),minute%5);assert.equal(themeIndex(minute*60000+59999),minute%5);}
  assert.equal(themeIndex(-200),0);
});
test('normal hands keep large cards and overlap enough to expose corners',()=>{
  const seven=fitHand(7,393,852),twelve=fitHand(12,393,852),twenty=fitHand(20,393,852);
  assert.equal(seven.cardWidth,100);assert.ok(twelve.cardWidth>=90);assert.ok(twenty.cardWidth>=90);
  for(const n of [7,12,20,40,108]){
    const f=fitHand(n,393,852);
    for(let i=1;i<f.placements.length;i++)if(f.placements[i].row===f.placements[i-1].row)assert.ok(f.placements[i].x-f.placements[i-1].x>=f.cardWidth*.2399);
  }
});
